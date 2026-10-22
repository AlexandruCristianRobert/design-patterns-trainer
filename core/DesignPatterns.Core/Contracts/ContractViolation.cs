using System.Text.Json.Serialization;

namespace DesignPatterns.Core.Contracts;

public enum ContractViolationCode { [JsonStringEnumMemberName("missingType")] MissingType, [JsonStringEnumMemberName("wrongKind")] WrongKind, [JsonStringEnumMemberName("missingMember")] MissingMember }

public sealed record ContractViolation(ContractViolationCode Code, string Type, string? Member = null);
