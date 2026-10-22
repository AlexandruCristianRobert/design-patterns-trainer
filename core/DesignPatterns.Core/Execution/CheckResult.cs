using System.Text.Json.Serialization;

namespace DesignPatterns.Core;

public enum CheckStatus { [JsonStringEnumMemberName("passed")] Passed, [JsonStringEnumMemberName("failed")] Failed, [JsonStringEnumMemberName("errored")] Errored, [JsonStringEnumMemberName("timedOut")] TimedOut }

public sealed record CheckResult(
    string Id,
    CheckStatus Status,
    string? Reason = null,
    IReadOnlyDictionary<string, string>? Args = null);
