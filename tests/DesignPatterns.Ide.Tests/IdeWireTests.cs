using System.Text.Json;

namespace DesignPatterns.Ide.Tests;

public class IdeWireTests
{
    private static readonly CancellationToken Ct = CancellationToken.None;

    private static string At(string source, int line, int column) =>
        JsonSerializer.Serialize(new { source, line, column });

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private static (int, int, int, int) RangeOf(JsonElement e)
    {
        var r = e.GetProperty("range");
        return (r.GetProperty("startLine").GetInt32(), r.GetProperty("startColumn").GetInt32(),
            r.GetProperty("endLine").GetInt32(), r.GetProperty("endColumn").GetInt32());
    }

    private static IEnumerable<string> Labels(JsonElement e) =>
        e.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("label").GetString()!);

    [Fact]
    public async Task Complete_ConsoleDot_At1_9_ListsWriteLine_WithEmptyRangeAtCursor()
    {
        var answer = Parse(await IdeWire.CompleteAsync(At("Console.", 1, 9), Ct));
        Assert.Contains("WriteLine", Labels(answer));
        Assert.Equal((1, 9, 1, 9), RangeOf(answer));
    }

    [Fact]
    public async Task Complete_CrlfSource_CursorOnLine2_MapsBothWays()
    {
        const string src = "var xs = new List<int>();\r\nxs.Ad";
        var answer = Parse(await IdeWire.CompleteAsync(At(src, 2, 6), Ct));
        Assert.Contains("Add", Labels(answer));
        Assert.Equal((2, 4, 2, 6), RangeOf(answer)); // replaces the partial "Ad"
    }

    [Fact]
    public async Task Hover_AndDefinition_OnWhitespace_AnswerNull()
    {
        const string src = "var x = 1;\n\nConsole.WriteLine(x);";
        Assert.Equal("null", await IdeWire.HoverAsync(At(src, 2, 1), Ct));
        Assert.Equal("null", await IdeWire.DefinitionAsync(At(src, 2, 1), Ct));
    }

    [Fact]
    public async Task Definition_OfBclSymbol_AnswersNull()
    {
        Assert.Equal("null", await IdeWire.DefinitionAsync(At("Console.WriteLine();", 1, 3), Ct));
    }

    [Theory]
    [InlineData("""{"line":1,"column":1}""")]
    [InlineData("null")]
    public async Task MissingSource_FailsWithClearError(string json)
    {
        var e = await Assert.ThrowsAsync<ArgumentException>(() => IdeWire.CompleteAsync(json, Ct));
        Assert.Contains("Empty IDE request", e.Message);
        var f = await Assert.ThrowsAsync<ArgumentException>(() => IdeWire.FormatAsync("{}", Ct));
        Assert.Contains("Empty IDE request", f.Message);
    }
}

public class IdeRequestsTests
{
    private static string BigFile()
    {
        var lines = new List<string> { "var list = new List<int>();", "list." };
        for (var i = 0; lines.Count < 150; i++)
            lines.Add($"class H{i} {{ int _n; public void Handle(string r) {{ if (r.Length > {i}) _n++; }} }}");
        return JsonSerializer.Serialize(new { source = string.Join("\n", lines), line = 2, column = 6 });
    }

    [Fact]
    public async Task Cancel_WhileARequestRuns_AnswersCancelled()
    {
        var requests = new IdeRequests();
        var running = requests.RunAsync(7, async ct =>
        {
            await Task.Delay(Timeout.Infinite, ct);
            return "never";
        });
        Assert.False(running.IsCompleted);
        requests.Cancel(7);
        Assert.Equal(IdeWire.Cancelled, await running);
    }

    [Fact]
    public async Task Cancel_DuringARealCompletion_IsHonouredByRoslyn()
    {
        var requests = new IdeRequests();
        var json = BigFile();
        // The cancel lands after the request is registered and before Roslyn checks the token.
        var answer = await requests.RunAsync(3, ct =>
        {
            requests.Cancel(3);
            return IdeWire.CompleteAsync(json, ct);
        });
        Assert.Equal(IdeWire.Cancelled, answer);
    }

    [Fact]
    public async Task UncancelledRequest_AnswersNormally_AndUnknownCancelIsIgnored()
    {
        var requests = new IdeRequests();
        requests.Cancel(99);
        var answer = await requests.RunAsync(1, ct => IdeWire.CompleteAsync(BigFile(), ct));
        Assert.Contains("\"items\"", answer);
    }

    [Fact]
    public async Task AFailure_ThatIsNotACancellation_Propagates()
    {
        var requests = new IdeRequests();
        await Assert.ThrowsAsync<ArgumentException>(() => requests.RunAsync(1, ct => IdeWire.CompleteAsync("{}", ct)));
    }
}
