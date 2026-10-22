using DesignPatterns.Core.Contracts;
using DesignPatterns.Core.Protocol;
using DesignPatterns.Core.Tests.Execution;

namespace DesignPatterns.Core.Tests.Protocol;

[Collection(ConsoleCaptureCollection.Name)]
public class ServicesTests
{
    [Fact] public void Check_StopsAtContractViolation() {
        var r = CompilerService.Compile(new("public class A {}", CompilePurpose.Check, "static class C {}",
            new Contract([new("Logger", ContractTypeKind.Class, [])])));
        Assert.False(r.Success); Assert.Null(r.AssemblyBase64);
        Assert.Equal(ContractViolationCode.MissingType, Assert.Single(r.ContractViolations).Code);
    }
    [Fact] public async Task Singleton_EndToEndThroughJson() {
        var compiled = ProtocolJson.Deserialize<CompileResponse>(ProtocolJson.Serialize(CompilerService.Compile(new(
            CheckRunTests.Singleton, CompilePurpose.Check, CheckRunTests.SingletonChecks,
            new Contract([new("Logger", ContractTypeKind.Class, ["static Logger Instance { get; }"])])))));
        var runner = new RunnerService();
        var loaded = runner.Load(new(compiled.AssemblyBase64!, CheckRunTests.Singleton));
        Assert.False(loaded.HasEntryPoint);
        foreach (var id in loaded.CheckIds) Assert.Equal(CheckStatus.Passed, (await runner.RunCheckAsync(id)).Status);
    }
    [Fact] public Task RunBeforeLoad_Throws() => Assert.ThrowsAsync<InvalidOperationException>(() => new RunnerService().RunMainAsync());
}
