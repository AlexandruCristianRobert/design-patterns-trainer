using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using DesignPatterns.Core.Protocol;

namespace DesignPatterns.Wasm;

[SupportedOSPlatform("browser")]
public static partial class RunnerExports
{
    private static readonly RunnerService Runner = new();

    [JSExport]
    public static string Load(string requestJson) =>
        ProtocolJson.Serialize(Runner.Load(ProtocolJson.Deserialize<LoadRequest>(requestJson)));

    [JSExport]
    public static async Task<string> RunMain() => ProtocolJson.Serialize(await Runner.RunMainAsync());

    [JSExport]
    public static async Task<string> RunCheck(string id) => ProtocolJson.Serialize(await Runner.RunCheckAsync(id));
}
