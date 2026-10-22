using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using DesignPatterns.Core.Protocol;

namespace DesignPatterns.Wasm;

[SupportedOSPlatform("browser")]
public static partial class CompilerExports
{
    [JSExport]
    public static string Compile(string requestJson) =>
        ProtocolJson.Serialize(CompilerService.Compile(ProtocolJson.Deserialize<CompileRequest>(requestJson)));

    [JSExport]
    public static string WarmUp()
    {
        var response = CompilerService.Compile(new CompileRequest("Console.WriteLine(1);", CompilePurpose.Run));
        // Thrown into JS, so a broken compiler becomes the worker's bootError instead of a silent "ok".
        if (!response.Success)
            throw new InvalidOperationException(
                "Compiler warm-up failed: " + string.Join("; ", response.Diagnostics.Select(d => $"{d.Id}: {d.Message}")));
        return "ok";
    }
}
