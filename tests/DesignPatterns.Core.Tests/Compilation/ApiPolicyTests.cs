using DesignPatterns.Core.Compilation;

namespace DesignPatterns.Core.Tests.Compilation;

public class ApiPolicyTests
{
    [Theory]
    [InlineData("System.IO.File.ReadAllText(\"a\");", "System.IO.File")]
    [InlineData("Console.ReadLine();", "System.Console.ReadLine")]
    [InlineData("new Thread(() => {}).Start();", "System.Threading.Thread")]
    [InlineData("Parallel.For(0, 2, i => {});", "System.Threading.Tasks.Parallel")]
    [InlineData("Environment.Exit(0);", "System.Environment.Exit")]
    public void Forbidden_ReportsDP0001(string code, string api)
    {
        var r = CSharpCompiler.Analyze(code);
        var d = Assert.Single(r.Diagnostics, d => d.Id == "DP0001");
        Assert.Equal(api, d.Args!["api"]);
        Assert.Equal($"Not available in the browser runtime: {api}", d.Message);
        Assert.Equal(DiagnosticLevel.Error, d.Level);
        Assert.Equal(SourceFile.User, d.File);
        Assert.False(r.Success);
    }

    [Theory]
    [InlineData("var w = new System.IO.StringWriter(); w.Write(1);")]
    [InlineData("await Task.Delay(1); var t = Task.Run(() => 1);")]
    [InlineData("var l = new Lazy<int>(() => 1); lock (l) { }")]
    public void Allowed_HasNoDP0001(string code) =>
        Assert.DoesNotContain(CSharpCompiler.Analyze(code).Diagnostics, d => d.Id == "DP0001");

    [Fact]
    public void Forbidden_BlocksEmit() => Assert.Null(CSharpCompiler.Build("Console.ReadLine();").Assembly);

    [Fact]
    public void Forbidden_Build_IsNotSuccess() => Assert.False(CSharpCompiler.Build("Console.ReadLine();").Success);

    [Fact]
    public void Position_IsOffendingNode()
    {
        var d = Assert.Single(CSharpCompiler.Analyze("var x = 1;\nConsole.ReadLine();").Diagnostics, d => d.Id == "DP0001");
        Assert.Equal(2, d.StartLine);
        Assert.Equal(9, d.StartColumn);
    }

    [Theory]
    [InlineData("var t = new Thread(() => {});")]
    [InlineData("var t = new System.Threading.Thread(() => {});")]
    [InlineData("foreach (var t in new Thread[0]) { }")]
    public void Var_IsNotReportedAgainWhenTheStatementAlreadyReportsTheType(string code) =>
        Assert.Single(CSharpCompiler.Analyze(code).Diagnostics, d => d.Id == "DP0001");
}
