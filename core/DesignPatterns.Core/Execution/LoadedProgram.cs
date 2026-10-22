using System.Reflection;
using System.Runtime.Loader;

namespace DesignPatterns.Core.Execution;

public sealed class LoadedProgram
{
    private LoadedProgram(Assembly assembly, string source)
    {
        Assembly = assembly;
        Source = source;
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
                && m.GetParameters().Length <= 1);
}
