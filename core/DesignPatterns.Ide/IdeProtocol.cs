namespace DesignPatterns.Ide;

/// <summary>One completion entry. <see cref="Kind"/> is a fixed lowercase vocabulary (class, method, keyword, ...).</summary>
public sealed record CompletionItemInfo(string Label, string Kind, string? Detail, string InsertText);

/// <summary>Completion items plus the user-source range (offsets) that an accepted item replaces.</summary>
public sealed record CompletionResult(IReadOnlyList<CompletionItemInfo> Items, int ReplaceStart, int ReplaceEnd);

public sealed record HoverResult(string Markdown, int Start, int End);

public sealed record DefinitionResult(int Start, int End);
