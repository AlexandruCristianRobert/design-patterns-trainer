using DesignPatterns.Core;
using DesignPatterns.Core.Compilation;
using DesignPatterns.Core.Contracts;
using DesignPatterns.Core.Execution;
using DesignPatterns.Core.Protocol;

namespace DesignPatterns.Content.Tests;

public sealed record ValidationResult(IReadOnlyList<string> Errors, IReadOnlyList<string> Warnings);

public static class ContentValidator
{
    private static readonly string[] Kinds = ["complete", "refactor", "build"];

    private sealed class TextYaml
    {
        public string? Title { get; set; }
        public string? Scenario { get; set; }
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

        var solution = Compile(ex.Solution, ex.Checks, ex.Contract);
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

        var starter = Compile(ex.Starter, ex.Checks, ex.Contract);
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

        ValidateText(ex.TextEnPathsByLocale, ex.Checks, ids, expectedLocales, errors, warnings);
        return new ValidationResult(errors.Select(e => prefix + e).ToList(), warnings.Select(w => prefix + w).ToList());
    }

    /// <summary>The one starter every Exam Question opens with (same literal as web EXAM_STARTER).</summary>
    public const string ExamStarter = "// Write your solution here.\n";

    public static async Task<ValidationResult> ValidateExamQuestionAsync(ExamQuestionFiles q, IReadOnlySet<string>? expectedLocales = null)
    {
        var errors = new List<string>();
        var warnings = new List<string>();
        var prefix = $"{q.PatternId}/exam/{q.QuestionId}: ";

        if (q.LoadErrors is { Count: > 0 })
            return new ValidationResult(q.LoadErrors.Select(e => prefix + e).ToList(), warnings);

        IReadOnlyList<string>? ids = null;
        var solution = Compile(q.Solution, q.Checks, q.Contract);
        if (solution.Failure is { } sf) errors.Add($"solution: {sf}");
        else
        {
            var program = LoadedProgram.Load(Convert.FromBase64String(solution.Response!.AssemblyBase64!), q.Solution);
            ids = program.CheckIds;
            if (ids.Count == 0) errors.Add("checks.cs defines no checks");
            foreach (var id in ids)
            {
                var r = await RunBounded(program, id);
                if (r.Status != CheckStatus.Passed) errors.Add($"solution fails check '{id}': {Describe(r)}");
            }
        }

        // EXAM_STARTER must not pass: failing to compile against the Contract counts as failing.
        var starter = Compile(ExamStarter, q.Checks, q.Contract);
        if (starter.Failure is null)
        {
            var program = LoadedProgram.Load(Convert.FromBase64String(starter.Response!.AssemblyBase64!), ExamStarter);
            var anyFails = false;
            foreach (var id in program.CheckIds)
                if ((await RunBounded(program, id)).Status != CheckStatus.Passed) { anyFails = true; break; }
            if (!anyFails) errors.Add("EXAM_STARTER already passes every check; it must fail at least one");
        }

        ValidateText(q.TextEnPathsByLocale, q.Checks, ids, expectedLocales, errors, warnings);
        ValidateRoleNames(q, errors);
        return new ValidationResult(errors.Select(e => prefix + e).ToList(), warnings.Select(w => prefix + w).ToList());
    }

    /// <summary>Errors where a Pattern's examQuestions list and its exam/* directories disagree.</summary>
    public static IReadOnlyList<string> ValidateExamListing(string contentRoot) =>
        ContentLocator.ExamListings(contentRoot).SelectMany(l =>
            (l.Error is null ? Enumerable.Empty<string>() : [$"{l.PatternId}: cannot read pattern.yaml: {l.Error}"])
            .Concat(l.Listed.Except(l.OnDisk).Order().Select(id => $"{l.PatternId}: examQuestions lists '{id}' but exam/{id} does not exist")
            .Concat(l.OnDisk.Except(l.Listed).Order().Select(id => $"{l.PatternId}: exam/{id} exists but is not in examQuestions"))
            .Concat(l.Listed.GroupBy(x => x).Where(g => g.Count() > 1).Select(g => $"{l.PatternId}: examQuestions lists '{g.Key}' more than once"))))
        .ToList();

    private static readonly System.Text.RegularExpressions.Regex Identifier = new("[A-Za-z_][A-Za-z0-9_]*");
    private static readonly System.Text.RegularExpressions.Regex WordPart = new("[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+");

    private static void ValidateRoleNames(ExamQuestionFiles q, List<string> errors)
    {
        var banned = q.RoleNames.Append(q.PatternName)
            .Select(b => WordPart.Matches(b).Select(m => m.Value.ToLowerInvariant()).ToList())
            .Where(w => w.Count > 0).ToList();

        // Splits PascalCase / camelCase / prose into words (IStockObserver gives I, Stock, Observer) and
        // returns the first run of words, as written, that matches a banned term whole-word, case-insensitively.
        // A word matches a role word when equal, or the role word plus s / es, or y becomes ies (plurals leak the Pattern too).
        static bool IsWord(string word, string role) =>
            word == role || word == role + "s" || word == role + "es" || (role.EndsWith('y') && word == role[..^1] + "ies");

        string? Scan(string source)
        {
            var words = WordPart.Matches(source).Select(m => m.Value).ToList();
            var lower = words.Select(w => w.ToLowerInvariant()).ToList();
            foreach (var bw in banned)
                for (var i = 0; i + bw.Count <= lower.Count; i++)
                    if (bw.Select((w, k) => k < bw.Count - 1 ? lower[i + k] == w : IsWord(lower[i + k], w)).All(x => x))
                        return string.Join(" ", words.Skip(i).Take(bw.Count));
            return null;
        }

        foreach (var t in q.Contract.Types)
        {
            if (Scan(t.Name) is { } w) errors.Add($"contract names a Pattern role: {w} (type {t.Name})");
            foreach (var m in t.Members)
                foreach (var id in Identifier.Matches(m).Select(x => x.Value))
                    if (Scan(id) is { } mw) errors.Add($"contract names a Pattern role: {mw} (member '{m}' of type {t.Name})");
        }

        if (q.TextEnPathsByLocale.TryGetValue("en", out var enPath))
        {
            TextYaml? text = null;
            try { text = ContentLocator.Yaml.Deserialize<TextYaml>(File.ReadAllText(enPath)); } catch (Exception) { /* ValidateText reports it */ }
            if (text?.Title is { } title && Scan(title) is { } tw) errors.Add($"title names a Pattern role: {tw}");
            if (text?.Scenario is { } scenario && Scan(scenario) is { } sw) errors.Add($"scenario names a Pattern role: {sw}");
        }
    }

    private static (CompileResponse? Response, string? Failure) Compile(string source, string checks, Contract contract)
    {
        var r = CompilerService.Compile(new CompileRequest(source, CompilePurpose.Check, checks, contract));
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

    private static void ValidateText(IReadOnlyDictionary<string, string> texts, string checksSource,
        IReadOnlyList<string>? ids, IReadOnlySet<string>? expectedLocales, List<string> errors, List<string> warnings)
    {
        if (!texts.TryGetValue("en", out var enPath)) errors.Add("text.en.yaml is missing");
        // Id-based checks need the discovered ids, which exist only when the solution compiled.
        else if (ids is not null)
        {
            var reasons = CheckReasonScanner.CustomReasonsByCheck(checksSource);
            foreach (var m in TextProblems(enPath, ids, reasons)) errors.Add($"text.en.yaml: {m}");
            foreach (var (lng, path) in texts.Where(kv => kv.Key != "en"))
                foreach (var m in TextProblems(path, ids, reasons)) warnings.Add($"text.{lng}.yaml: {m}");
        }
        foreach (var lng in (expectedLocales ?? new HashSet<string>()).Where(l => l != "en" && !texts.ContainsKey(l)).Order())
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
