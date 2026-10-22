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
        CompilerService.Compile(new CompileRequest("Console.WriteLine(1);", CompilePurpose.Run));
        return "ok";
    }
}
