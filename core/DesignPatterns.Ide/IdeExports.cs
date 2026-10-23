using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;

namespace DesignPatterns.Ide;

/// <summary>
/// The browser binding of <see cref="IdeWire"/>. It lives in this lazy-loaded assembly (ADR 0003), so the default bundle
/// never touches a Workspaces type. JavaScript sees it after <c>runtime.getAssemblyExports('DesignPatterns.Ide')</c> as
/// <c>DesignPatterns.Ide.IdeExports</c>.
/// <para>
/// [JSExport] cannot take a CancellationToken, so each request carries the worker's request id and <see cref="Cancel"/>
/// trips its token. That only has an effect if the worker gets to run between two awaits of the request.
/// </para>
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class IdeExports
{
    private static readonly Dictionary<int, CancellationTokenSource> Running = [];

    [JSExport]
    public static async Task<string> WarmUp()
    {
        await IdeWire.WarmUpAsync();
        return "ok";
    }

    [JSExport]
    public static Task<string> Complete(string requestJson, int requestId) => Run(requestId, ct => IdeWire.CompleteAsync(requestJson, ct));

    [JSExport]
    public static Task<string> Hover(string requestJson, int requestId) => Run(requestId, ct => IdeWire.HoverAsync(requestJson, ct));

    [JSExport]
    public static Task<string> Definition(string requestJson, int requestId) => Run(requestId, ct => IdeWire.DefinitionAsync(requestJson, ct));

    [JSExport]
    public static Task<string> Format(string requestJson, int requestId) => Run(requestId, ct => IdeWire.FormatAsync(requestJson, ct));

    /// <summary>Cancels a running request; unknown or finished ids are ignored.</summary>
    [JSExport]
    public static void Cancel(int requestId)
    {
        if (Running.TryGetValue(requestId, out var cts)) cts.Cancel();
    }

    private static async Task<string> Run(int requestId, Func<CancellationToken, Task<string>> call)
    {
        using var cts = new CancellationTokenSource();
        Running[requestId] = cts;
        try
        {
            return await call(cts.Token);
        }
        catch (OperationCanceledException) when (cts.IsCancellationRequested)
        {
            return IdeWire.Cancelled;
        }
        finally
        {
            Running.Remove(requestId);
        }
    }
}
