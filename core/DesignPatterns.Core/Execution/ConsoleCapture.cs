namespace DesignPatterns.Core.Execution;

public static class ConsoleCapture
{
    /// <summary>
    /// Redirects <see cref="Console.Out"/> while <paramref name="action"/> runs and restores it afterwards.
    /// Console.SetOut is process-global, so callers must not run captures concurrently.
    /// </summary>
    public static async Task<(string Stdout, bool Truncated)> RunAsync(Func<Task> action)
    {
        var original = Console.Out;
        var writer = new CappedStringWriter(RuntimeLimits.MaxOutputChars);
        Console.SetOut(writer);
        try { await action(); }
        finally { Console.SetOut(original); }
        return (writer.ToString(), writer.Truncated);
    }
}
