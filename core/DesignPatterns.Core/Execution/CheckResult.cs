namespace DesignPatterns.Core;

public enum CheckStatus { Passed, Failed, Errored, TimedOut }

public sealed record CheckResult(
    string Id,
    CheckStatus Status,
    string? Reason = null,
    IReadOnlyDictionary<string, string>? Args = null);
