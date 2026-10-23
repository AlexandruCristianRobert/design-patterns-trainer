using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace DesignPatterns.Ide;

/// <summary>A request at a Monaco position (1-based line and column).</summary>
public sealed record IdePositionRequest(string Source, int Line, int Column);

public sealed record IdeFormatRequest(string Source);

/// <summary>A Monaco range: 1-based, end exclusive.</summary>
public sealed record IdeRange(int StartLine, int StartColumn, int EndLine, int EndColumn);

public sealed record IdeCompletionResponse(IReadOnlyList<CompletionItemInfo> Items, IdeRange Range);

public sealed record IdeHoverResponse(string Markdown, IdeRange Range);

public sealed record IdeDefinitionResponse(IdeRange Range);

public sealed record IdeFormatResponse(string Text);

[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(IdePositionRequest))]
[JsonSerializable(typeof(IdeFormatRequest))]
[JsonSerializable(typeof(IdeCompletionResponse))]
[JsonSerializable(typeof(IdeHoverResponse))]
[JsonSerializable(typeof(IdeDefinitionResponse))]
[JsonSerializable(typeof(IdeFormatResponse))]
internal sealed partial class IdeJsonContext : JsonSerializerContext;

/// <summary>
/// The JSON surface of <see cref="IdeService"/> for the worker: Monaco positions in, Monaco ranges out, conversions via
/// <see cref="Positions"/>. Platform-neutral; <see cref="IdeExports"/> only adds the browser binding and cancellation.
/// </summary>
public static class IdeWire
{
    /// <summary>What a request that was cancelled by a newer one answers.</summary>
    public const string Cancelled = """{"cancelled":true}""";

    public static async Task<string> CompleteAsync(string requestJson, CancellationToken ct)
    {
        var req = Read(requestJson, IdeJsonContext.Default.IdePositionRequest);
        var result = await IdeService.CompleteAsync(req.Source, Positions.ToOffset(req.Source, req.Line, req.Column), ct)
            .ConfigureAwait(false);
        return Write(new IdeCompletionResponse(result.Items, Range(req.Source, result.ReplaceStart, result.ReplaceEnd)),
            IdeJsonContext.Default.IdeCompletionResponse);
    }

    public static async Task<string> HoverAsync(string requestJson, CancellationToken ct)
    {
        var req = Read(requestJson, IdeJsonContext.Default.IdePositionRequest);
        var result = await IdeService.HoverAsync(req.Source, Positions.ToOffset(req.Source, req.Line, req.Column), ct)
            .ConfigureAwait(false);
        return result is null
            ? "null"
            : Write(new IdeHoverResponse(result.Markdown, Range(req.Source, result.Start, result.End)),
                IdeJsonContext.Default.IdeHoverResponse);
    }

    public static async Task<string> DefinitionAsync(string requestJson, CancellationToken ct)
    {
        var req = Read(requestJson, IdeJsonContext.Default.IdePositionRequest);
        var result = await IdeService.DefinitionAsync(req.Source, Positions.ToOffset(req.Source, req.Line, req.Column), ct)
            .ConfigureAwait(false);
        return result is null
            ? "null"
            : Write(new IdeDefinitionResponse(Range(req.Source, result.Start, result.End)),
                IdeJsonContext.Default.IdeDefinitionResponse);
    }

    public static async Task<string> FormatAsync(string requestJson, CancellationToken ct)
    {
        var req = Read(requestJson, IdeJsonContext.Default.IdeFormatRequest);
        var text = await IdeService.FormatAsync(req.Source, ct).ConfigureAwait(false);
        return Write(new IdeFormatResponse(text), IdeJsonContext.Default.IdeFormatResponse);
    }

    /// <summary>
    /// Builds the workspace and runs one completion and one format, so the learner's first requests are not the
    /// cold, JIT-heavy ones (about 0.9 s and 0.7 s in the spike).
    /// </summary>
    public static async Task WarmUpAsync()
    {
        const string sample = "var list = new List<int> { 1 };\nlist.\nclass C { void M() { } }\n";
        var completion = await IdeService.CompleteAsync(sample, sample.IndexOf("list.\n", StringComparison.Ordinal) + 5,
            CancellationToken.None).ConfigureAwait(false);
        if (completion.Items.Count == 0) throw new InvalidOperationException("IDE warm-up: completion returned nothing.");
        await IdeService.FormatAsync(sample, CancellationToken.None).ConfigureAwait(false);
    }

    private static IdeRange Range(string source, int start, int end)
    {
        var (startLine, startColumn) = Positions.ToLineColumn(source, start);
        var (endLine, endColumn) = Positions.ToLineColumn(source, end);
        return new IdeRange(startLine, startColumn, endLine, endColumn);
    }

    private static T Read<T>(string json, JsonTypeInfo<T> info) =>
        JsonSerializer.Deserialize(json, info) ?? throw new ArgumentException("Empty IDE request.");

    private static string Write<T>(T value, JsonTypeInfo<T> info) => JsonSerializer.Serialize(value, info);
}
