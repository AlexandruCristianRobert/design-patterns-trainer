using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;

namespace DesignPatterns.Ide;

/// <summary>
/// The browser binding of <see cref="IdeWire"/> and <see cref="IdeRequests"/>: thin forwarding only. It lives in this
/// lazy-loaded assembly (ADR 0003), so the default bundle never touches a Workspaces type. JavaScript sees it after
/// <c>runtime.getAssemblyExports('DesignPatterns.Ide')</c> as <c>DesignPatterns.Ide.IdeExports</c>.
/// </summary>
[SupportedOSPlatform("browser")]
public static partial class IdeExports
{
    private static readonly IdeRequests Requests = new();

    [JSExport]
    public static async Task<string> WarmUp()
    {
        await IdeWire.WarmUpAsync();
        return "ok";
    }

    [JSExport]
    public static Task<string> Complete(string requestJson, int requestId) =>
        Requests.RunAsync(requestId, ct => IdeWire.CompleteAsync(requestJson, ct));

    [JSExport]
    public static Task<string> Hover(string requestJson, int requestId) =>
        Requests.RunAsync(requestId, ct => IdeWire.HoverAsync(requestJson, ct));

    [JSExport]
    public static Task<string> Definition(string requestJson, int requestId) =>
        Requests.RunAsync(requestId, ct => IdeWire.DefinitionAsync(requestJson, ct));

    [JSExport]
    public static Task<string> Format(string requestJson, int requestId) =>
        Requests.RunAsync(requestId, ct => IdeWire.FormatAsync(requestJson, ct));

    [JSExport]
    public static void Cancel(int requestId) => Requests.Cancel(requestId);
}
