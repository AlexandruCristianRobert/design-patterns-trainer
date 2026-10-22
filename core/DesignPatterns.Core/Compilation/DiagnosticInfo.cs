namespace DesignPatterns.Core.Compilation;

public enum DiagnosticLevel { Error, Warning, Info }

public enum SourceFile { User, Checks }

/// <summary>A compiler diagnostic with 1-based line/column positions.</summary>
public sealed record DiagnosticInfo(
    string Id,
    DiagnosticLevel Level,
    string Message,
    SourceFile File,
    int StartLine,
    int StartColumn,
    int EndLine,
    int EndColumn,
    IReadOnlyDictionary<string, string>? Args = null);
