namespace DesignPatterns.Ide.Tests;

public class IdeServiceTests
{
    private static readonly CancellationToken Ct = CancellationToken.None;

    private static int After(string source, string marker) => source.IndexOf(marker, StringComparison.Ordinal) + marker.Length;

    [Fact]
    public async Task Complete_ConsoleDot_ListsWriteLineMethod()
    {
        const string src = "Console.";
        var r = await IdeService.CompleteAsync(src, src.Length, Ct);
        Assert.Contains(r.Items, i => i.Label == "WriteLine" && i.Kind == "method");
        Assert.DoesNotContain(r.Items, i => i.Kind == "keyword");
        Assert.Equal((src.Length, src.Length), (r.ReplaceStart, r.ReplaceEnd));
    }

    [Fact]
    public async Task Complete_ListMember_ListsAdd_AndReplaceRangeCoversPartial()
    {
        const string src = "var xs = new List<int>(); xs.Ad";
        var r = await IdeService.CompleteAsync(src, src.Length, Ct);
        Assert.Contains(r.Items, i => i.Label == "Add" && i.Kind == "method");
        Assert.Equal((src.Length - 2, src.Length), (r.ReplaceStart, r.ReplaceEnd));
    }

    [Fact]
    public async Task Complete_UserTypeMembers_AfterDot()
    {
        const string src = "var d = new Dog(); d.\nclass Dog { public string Name { get; set; } public void Bark() {} }";
        var r = await IdeService.CompleteAsync(src, After(src, "d."), Ct);
        Assert.Contains(r.Items, i => i.Label == "Bark" && i.Kind == "method");
        Assert.Contains(r.Items, i => i.Label == "Name" && i.Kind == "property");
    }

    [Fact]
    public async Task Complete_ImplicitLinq_GivesWhere()
    {
        const string src = "var xs = new List<int>(); xs.";
        var r = await IdeService.CompleteAsync(src, src.Length, Ct);
        Assert.Contains(r.Items, i => i.Label == "Where");
    }

    [Fact]
    public async Task Complete_TopLevel_IncludesKeywordsAndTypes()
    {
        const string src = "var n = 1;\n";
        var r = await IdeService.CompleteAsync(src, src.Length, Ct);
        Assert.Contains(r.Items, i => i.Label == "foreach" && i.Kind == "keyword");
        Assert.Contains(r.Items, i => i.Label == "Console" && i.Kind == "class");
        Assert.Contains(r.Items, i => i.Label == "n" && i.Kind == "local");
    }

    [Fact]
    public async Task Hover_WriteLine_ShowsSignatureInCodeFence()
    {
        const string src = "Console.WriteLine(\"hi\");";
        var r = await IdeService.HoverAsync(src, After(src, "Console.Write"), Ct);
        Assert.NotNull(r);
        Assert.StartsWith("```csharp\n", r!.Markdown);
        Assert.Contains("WriteLine(string", r.Markdown);
        Assert.Equal("WriteLine", src[r.Start..r.End]);
    }

    [Fact]
    public async Task Hover_UserClass_ShowsClassName_AndDocSummary()
    {
        const string src = "/// <summary>A pet.</summary>\nclass Dog { }\nvar d = new Dog();";
        var r = await IdeService.HoverAsync(src, src.LastIndexOf("Dog", StringComparison.Ordinal) + 1, Ct);
        Assert.NotNull(r);
        Assert.Contains("class Dog", r!.Markdown);
        Assert.Contains("A pet.", r.Markdown);
    }

    [Fact]
    public async Task Hover_Whitespace_IsNull()
    {
        Assert.Null(await IdeService.HoverAsync("var a = 1;", 7, Ct));
    }

    [Fact]
    public async Task Definition_UserMethod_ReturnsDeclarationSpan()
    {
        const string src = "Greet();\nvoid Greet() { }";
        var r = await IdeService.DefinitionAsync(src, 2, Ct);
        Assert.NotNull(r);
        Assert.Equal("Greet", src[r!.Start..r.End]);
        Assert.True(r.Start > src.IndexOf('\n'));
    }

    [Fact]
    public async Task Definition_Console_IsNullOutsideFile()
    {
        Assert.Null(await IdeService.DefinitionAsync("Console.WriteLine();", 2, Ct));
    }

    [Fact]
    public async Task Format_MinifiedClass_IsAllmanFourSpaces_KeepsLf()
    {
        var r = await IdeService.FormatAsync("class A{void M(){int x=1;}}", Ct);
        Assert.Equal("class A\n{\n    void M()\n    {\n        int x = 1;\n    }\n}", r);
    }

    [Fact]
    public async Task Format_Crlf_StaysCrlf()
    {
        var r = await IdeService.FormatAsync("class A{\r\nvoid M(){}}", Ct);
        Assert.Contains("\r\n", r);
        Assert.DoesNotContain("\n", r.Replace("\r\n", ""));
    }

    [Fact]
    public async Task CancelledToken_Throws()
    {
        using var cts = new CancellationTokenSource();
        await cts.CancelAsync();
        await Assert.ThrowsAsync<OperationCanceledException>(() => IdeService.CompleteAsync("x", 1, cts.Token));
        await Assert.ThrowsAsync<OperationCanceledException>(() => IdeService.HoverAsync("x", 0, cts.Token));
        await Assert.ThrowsAsync<OperationCanceledException>(() => IdeService.DefinitionAsync("x", 0, cts.Token));
        await Assert.ThrowsAsync<OperationCanceledException>(() => IdeService.FormatAsync("x", cts.Token));
    }

    [Fact]
    public async Task Integrity_CompilationHasExactlyTwoTrees()
    {
        var c = await IdeService.GetCompilationAsync("class A {}", Ct);
        Assert.Equal(2, c.SyntaxTrees.Count());
        Assert.Equal(["GlobalUsings.g.cs", "user.cs"], c.SyntaxTrees.Select(t => t.FilePath));
    }
}

public class PositionsTests
{
    [Theory]
    [InlineData("ab\r\ncd\r\nef")]
    [InlineData("ab\ncd\nef")]
    [InlineData("ab\ncd\n")]
    [InlineData("")]
    public void RoundTrips_EveryOffset(string text)
    {
        for (var o = 0; o <= text.Length; o++)
        {
            // An offset between \r and \n is not a valid editor position.
            if (o > 0 && o < text.Length && text[o - 1] == '\r' && text[o] == '\n') continue;
            var (l, c) = Positions.ToLineColumn(text, o);
            Assert.Equal(o, Positions.ToOffset(text, l, c));
        }
    }

    [Fact]
    public void KnownValues_CrlfAndLf_AndEndOfFile()
    {
        Assert.Equal((2, 2), Positions.ToLineColumn("ab\r\ncd", 5));
        Assert.Equal((2, 2), Positions.ToLineColumn("ab\ncd", 4));
        Assert.Equal(5, Positions.ToOffset("ab\r\ncd", 2, 2));
        Assert.Equal((2, 3), Positions.ToLineColumn("ab\ncd", 5));
        Assert.Equal(5, Positions.ToOffset("ab\ncd", 2, 99));
        Assert.Equal(5, Positions.ToOffset("ab\ncd", 9, 1));
    }
}
