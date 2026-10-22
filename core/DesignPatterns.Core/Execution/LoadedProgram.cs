using System.Reflection;
using System.Runtime.Loader;
using DesignPatterns.Checks;

namespace DesignPatterns.Core.Execution;

public sealed class LoadedProgram
{
    private LoadedProgram(Assembly assembly, string source)
    {
        Assembly = assembly;
        Source = source;
        _checks = DiscoverChecks(assembly);
    }

    private readonly IReadOnlyList<(string Id, MethodInfo Method)> _checks;

    public IReadOnlyList<string> CheckIds => _checks.Select(c => c.Id).ToList();

    private static List<(string Id, MethodInfo Method)> DiscoverChecks(Assembly assembly)
    {
        var found = new List<(string Id, MethodInfo Method)>();
        var seen = new HashSet<string>();
        foreach (var type in assembly.GetTypes())
        foreach (var m in type.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
        {
            var attr = m.GetCustomAttribute<CheckAttribute>();
            if (attr is null || m.GetParameters().Length != 0) continue;
            if (m.ReturnType != typeof(void) && m.ReturnType != typeof(Task)) continue;
            if (!seen.Add(attr.Id)) throw new InvalidOperationException($"Duplicate check id '{attr.Id}'");
            found.Add((attr.Id, m));
        }
        return found.OrderBy(c => c.Method.MetadataToken).ToList();
    }

    public async Task<CheckResult> RunCheckAsync(string id)
    {
        var method = _checks.FirstOrDefault(c => c.Id == id).Method
            ?? throw new ArgumentException($"Unknown check id '{id}'", nameof(id));
        CheckResult? result = null;
        await ConsoleCapture.RunAsync(async () =>
        {
            try
            {
                CheckContext.Current = new CheckContext(Assembly, Source);
                if (method.Invoke(null, null) is Task task) await task;
                result = new CheckResult(id, CheckStatus.Passed);
            }
            catch (Exception e)
            {
                var root = e;
                while (root is TargetInvocationException { InnerException: { } i }) root = i;
                if (root is CheckFailedException failed)
                    result = new CheckResult(id, CheckStatus.Failed, failed.Reason, failed.Args);
                else
                {
                    var info = ExceptionUnwrapper.Unwrap(e);
                    result = new CheckResult(id, CheckStatus.Errored, "threw",
                        new Dictionary<string, string> { ["type"] = info.Type, ["message"] = info.Message });
                }
            }
        });
        return result!;
    }

    public Assembly Assembly { get; }
    public string Source { get; }
    public bool HasEntryPoint => Assembly.EntryPoint is not null;

    /// <summary>Loads into a fresh, non-collectible context so identical type names never collide across loads.</summary>
    public static LoadedProgram Load(byte[] assembly, string userSource)
    {
        var context = new AssemblyLoadContext($"UserProgram_{Guid.NewGuid():N}", isCollectible: false);
        using var stream = new MemoryStream(assembly);
        return new LoadedProgram(context.LoadFromStream(stream), userSource);
    }

    public async Task<RunOutcome> RunMainAsync()
    {
        var entry = Assembly.EntryPoint;
        if (entry is null) return new RunOutcome("", false, null, false);

        ExceptionInfo? exception = null;
        var (stdout, truncated) = await ConsoleCapture.RunAsync(async () =>
        {
            try { await InvokeAsync(entry); }
            catch (Exception e) { exception = ExceptionUnwrapper.Unwrap(e); }
        });
        return new RunOutcome(stdout, truncated, exception, true);
    }

    private static async Task InvokeAsync(MethodInfo entry)
    {
        // For async entry points the compiler synthesizes a sync wrapper that blocks on GetResult();
        // that would deadlock single-threaded WebAssembly, so invoke and await the real async method.
        var method = FindAsyncMain(entry) ?? entry;
        var args = method.GetParameters().Length == 1 ? new object[] { Array.Empty<string>() } : null;
        var result = method.Invoke(null, args);
        if (result is Task task) await task;
    }

    private static MethodInfo? FindAsyncMain(MethodInfo entry) =>
        entry.DeclaringType?.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(m => m.Name is "<Main>$" or "Main"
                && typeof(Task).IsAssignableFrom(m.ReturnType)
                && HasEntryParameters(m));

    private static bool HasEntryParameters(MethodInfo m)
    {
        var ps = m.GetParameters();
        return ps.Length == 0 || ps.Length == 1 && ps[0].ParameterType == typeof(string[]);
    }
}
