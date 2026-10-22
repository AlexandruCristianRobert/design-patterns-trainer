namespace DesignPatterns.Core.Execution;

public static class ConsoleCapture
{
    /// <summary>
    /// Redirects <see cref="Console.Out"/> and <see cref="Console.Error"/> into one capped writer while
    /// <paramref name="action"/> runs and restores both afterwards.
    /// Console.SetOut/SetError are process-global, so callers must not run captures concurrently.
    /// </summary>
    public static async Task<(string Stdout, bool Truncated)> RunAsync(Func<Task> action)
    {
        var (originalOut, originalError) = (Console.Out, Console.Error);
        var writer = new CappedStringWriter(RuntimeLimits.MaxOutputChars);
        Console.SetOut(writer);
        Console.SetError(writer);
        try { await action(); }
        finally
        {
            Console.SetOut(originalOut);
            Console.SetError(originalError);
        }
        return (writer.ToString(), writer.Truncated);
    }
}
