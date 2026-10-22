using DesignPatterns.Core.Compilation;
using Microsoft.CodeAnalysis.CSharp;

namespace DesignPatterns.Core.Tests.Compilation;

public class CSharpCompilerTests
{
    [Fact]
    public void Build_HelloWorld_Succeeds()
    {
        var r = CSharpCompiler.Build("Console.WriteLine(\"hi\");");
        Assert.True(r.Success);
        Assert.NotNull(r.Assembly);
    }

    [Fact]
    public void Build_UndefinedName_ReportsCS0103AtPosition()
    {
        var d = Assert.Single(CSharpCompiler.Build("var x = y;").Diagnostics, d => d.Id == "CS0103");
        Assert.Equal((DiagnosticLevel.Error, SourceFile.User, 1, 9), (d.Level, d.File, d.StartLine, d.StartColumn));
    }

    [Fact]
    public void Build_UsesCSharp14() =>
        Assert.Equal(LanguageVersion.CSharp14, CSharpCompiler.Build("class A {}").Compilation.LanguageVersion);

    [Fact]
    public void Build_ImplicitUsings_AllowListAndLinq() =>
        Assert.True(CSharpCompiler.Build("var l = new List<int> { 1, 2 }; Console.WriteLine(l.Sum());").Success);

    [Fact]
    public void Build_NullableEnabled_WarnsCS8600() =>
        Assert.Contains(CSharpCompiler.Build("string s = null; Console.WriteLine(s);").Diagnostics,
            d => d.Id == "CS8600" && d.Level == DiagnosticLevel.Warning);

    [Fact]
    public void Build_LibraryWithoutEntryPoint_Succeeds() =>
        Assert.True(CSharpCompiler.Build("public class A {}").Success);

    [Fact]
    public void Analyze_DoesNotEmit() => Assert.Null(CSharpCompiler.Analyze("class A {}").Assembly);

    [Fact]
    public void Build_ChecksErrors_AreTaggedChecks() =>
        Assert.Contains(CSharpCompiler.Build("public class A {}", "static class C { static void M() { nope(); } }").Diagnostics,
            d => d.File == SourceFile.Checks && d.Id == "CS0103");
}
