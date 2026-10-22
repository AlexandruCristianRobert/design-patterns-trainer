using DesignPatterns.Core.Contracts;
using DesignPatterns.Core.Protocol;

namespace DesignPatterns.Core.Tests.Protocol;

public class ProtocolJsonTests
{
    [Fact] public void CompileRequest_ParsesCamelCaseJson() {
        var r = ProtocolJson.Deserialize<CompileRequest>("""
            {"source":"x","purpose":"check","checksSource":"y","contract":{"types":[{"name":"Logger","kind":"abstractClass","members":["static Logger Instance { get; }"]}]}}
            """);
        Assert.Equal((CompilePurpose.Check, ContractTypeKind.AbstractClass), (r.Purpose, r.Contract!.Types[0].Kind));
    }
    [Fact] public void CompileResponse_UsesCamelCaseEnumsAndOmitsNulls() {
        var json = ProtocolJson.Serialize(CompilerService.Compile(new("var x = y;", CompilePurpose.Diagnostics)));
        Assert.Contains("\"level\":\"error\"", json); Assert.Contains("\"file\":\"user\"", json); Assert.DoesNotContain("assemblyBase64", json);
    }
    [Fact] public void CheckResult_SerializesStatus() =>
        Assert.Contains("\"status\":\"timedOut\"", ProtocolJson.Serialize(new CheckResult("x", CheckStatus.TimedOut)));
}
