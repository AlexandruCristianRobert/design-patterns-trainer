namespace DesignPatterns.Ide;

/// <summary>
/// The running IDE requests by worker request id, so a later message can cancel one (a [JSExport] method cannot take a
/// CancellationToken). Platform-neutral; <see cref="IdeExports"/> forwards to one shared instance. Single-threaded use.
/// </summary>
public sealed class IdeRequests
{
    private readonly Dictionary<int, CancellationTokenSource> running = [];

    /// <summary>Runs <paramref name="call"/> under a token that <see cref="Cancel"/> trips; a cancelled call answers <see cref="IdeWire.Cancelled"/>.</summary>
    public async Task<string> RunAsync(int requestId, Func<CancellationToken, Task<string>> call)
    {
        using var cts = new CancellationTokenSource();
        running[requestId] = cts;
        try
        {
            return await call(cts.Token).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (cts.IsCancellationRequested)
        {
            return IdeWire.Cancelled;
        }
        finally
        {
            running.Remove(requestId);
        }
    }

    /// <summary>Cancels a running request; unknown or finished ids are ignored.</summary>
    public void Cancel(int requestId)
    {
        if (running.TryGetValue(requestId, out var cts)) cts.Cancel();
    }
}
