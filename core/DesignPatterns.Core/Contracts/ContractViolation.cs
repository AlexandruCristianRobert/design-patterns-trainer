namespace DesignPatterns.Core.Contracts;

public enum ContractViolationCode { MissingType, WrongKind, MissingMember }

public sealed record ContractViolation(ContractViolationCode Code, string Type, string? Member = null);
