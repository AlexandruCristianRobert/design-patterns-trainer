using DesignPatterns.Core;
using DesignPatterns.Core.Compilation;
using DesignPatterns.Core.Execution;
using DesignPatterns.Core.Protocol;

namespace DesignPatterns.Content.Tests;

public sealed record ValidationResult(IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings);

public static class ContentValidator
{
    private static readonly string[] Kinds = ["complete", "refactor", "build"];

    private sealed class TextYaml
    {
        public Dictionary<string, CheckTextYaml>? Checks { get; set; }
    }
    private sealed class CheckTextYaml
    {
        public string? Title { get; set; }
        public Dictionary<string, string>? Failures { get; set; }
    }

    /// <param name="expectedLocales">Locales other than "en" for which a missing text file warns
    /// (use <see cref="ContentLocator.Locales"/>); null means none expected.</param>
    public static async Task<ValidationResult> ValidateAsync(ExerciseFiles ex, IReadOnlySet<string>? expectedLocales = null)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        var prefix = $"{ex.PatternId}/{ex.ExerciseId}: ";

        if (ex.LoadErrors is { Count: > 0 })
            return new ValidationResult(ex.LoadErrors.Select(e => prefix + e).ToList(), warnings);

        if (!Kinds.Contains(ex.Kind)) errors.Add($"unknown exercise kind '{ex.Kind}' (expected complete, refactor or build)");

        var solution = Compile(ex.Solution, ex);
        IReadOnlyList<string>? ids = null;
        if (solution.Failure is { } sf) errors.Add($"solution: {sf}");
        else
        {
            var program = LoadedProgram.Load(Convert.FromBase64String(solution.Response!.AssemblyBase64!), ex.Solution);
            ids = program.CheckIds;
            if (ids.Count == 0) errors.Add("checks.cs defines no checks");
            foreach (var id in ids)
            {
                var r = await RunBounded(program, id);
                if (r.Status != CheckStatus.Passed) errors.Add($"solution fails check '{id}': {Describe(r)}");
            }
        }

        var starter = Compile(ex.Starter, ex);
        if (starter.Failure is { } stf)
        {
            if (ex.Kind != "build") errors.Add($"starter must compile and satisfy the contract for '{ex.Kind}' exercises: {stf}");
        }
        else
        {
            var program = LoadedProgram.Load(Convert.FromBase64String(starter.Response!.AssemblyBase64!), ex.Starter);
            var anyFails = false;
            foreach (var id in program.CheckIds)
                if ((await RunBounded(program, id)).Status != CheckStatus.Passed) { anyFails = true; break; }
            if (!anyFails) errors.Add("starter already passes every check; it must fail at least one");
        }

        ValidateText(ex, ids, expectedLocales, errors, warnings);
        return new ValidationResult(errors.Select(e => prefix + e).ToList(), warnings.Select(w => prefix + w).ToList());
    }

    private static (CompileResponse? Response, string? Failure) Compile(string source, ExerciseFiles ex)
    {
        var r = CompilerService.Compile(new CompileRequest(source, CompilePurpose.Check, ex.Checks, ex.Contract));
        if (r.Success && r.AssemblyBase64 is not null) return (r, null);
        var parts = r.Diagnostics.Where(d => d.Level == DiagnosticLevel.Error)
            .Select(d => $"{d.Id} {d.File} {d.StartLine}:{d.StartColumn} {d.Message}")
            .Concat(r.ContractViolations.Select(v => $"contract {v.Code} {v.Type}{(v.Member is null ? "" : "." + v.Member)}"));
        return (null, string.Join("; ", parts));
    }

    private static async Task<CheckResult> RunBounded(LoadedProgram program, string id)
    {
        var run = Task.Run(() => program.RunCheckAsync(id));
        var done = await Task.WhenAny(run, Task.Delay(RuntimeLimits.TimeoutMs));
        return done == run ? await run : new CheckResult(id, CheckStatus.TimedOut, "timedOut");
    }

    private static string Describe(CheckResult r) =>
        r.Status == CheckStatus.TimedOut ? "timed out"
        : $"{r.Status} ({r.Reason}{(r.Args is { Count: > 0 } a ? " " + string.Join(", ", a.Select(kv => $"{kv.Key}={kv.Value}")) : "")})";

    private static void ValidateText(ExerciseFiles ex, IReadOnlyList<string>? ids, IReadOnlySet<string>? expectedLocales,
        List<string> errors, List<string> warnings)
    {
        if (!ex.TextEnPathsByLocale.TryGetValue("en", out var enPath)) errors.Add("text.en.yaml is missing");
        // Id-based checks need the discovered ids, which exist only when the solution compiled.
        else if (ids is not null)
        {
            var reasons = CheckReasonScanner.CustomReasonsByCheck(ex.Checks);
            foreach (var m in TextProblems(enPath, ids, reasons)) errors.Add($"text.en.yaml: {m}");
            foreach (var (lng, path) in ex.TextEnPathsByLocale.Where(kv => kv.Key != "en"))
                foreach (var m in TextProblems(path, ids, reasons)) warnings.Add($"text.{lng}.yaml: {m}");
        }
        foreach (var lng in (expectedLocales ?? new HashSet<string>()).Where(l => l != "en" && !ex.TextEnPathsByLocale.ContainsKey(l)).Order())
            warnings.Add($"text.{lng}.yaml is missing");
    }

    private static IEnumerable<string> TextProblems(string path, IReadOnlyList<string> ids,
        IReadOnlyDictionary<string, IReadOnlySet<string>> reasons)
    {
        TextYaml text;
        try { text = ContentLocator.Yaml.Deserialize<TextYaml>(File.ReadAllText(path)) ?? new TextYaml(); }
        catch (Exception e) { return [$"cannot parse: {e.Message}"]; }
        return Problems(text, ids, reasons).ToList();
    }

    private static IEnumerable<string> Problems(TextYaml text, IReadOnlyList<string> ids,
        IReadOnlyDictionary<string, IReadOnlySet<string>> reasons)
    {
        var checks = text.Checks ?? [];
        foreach (var id in ids)
        {
            checks.TryGetValue(id, out var c);
            if (c is null || string.IsNullOrWhiteSpace(c.Title))
                yield return $"missing title for check '{id}'";
            foreach (var reason in reasons.GetValueOrDefault(id) ?? new HashSet<string>())
                if (c?.Failures is null || !c.Failures.ContainsKey(reason))
                    yield return $"missing failure message '{reason}' for check '{id}'";
        }
        foreach (var id in checks.Keys.Where(k => !ids.Contains(k)))
            yield return $"text entry for unknown check '{id}'";
    }
}
