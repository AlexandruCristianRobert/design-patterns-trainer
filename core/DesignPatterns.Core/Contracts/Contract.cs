namespace DesignPatterns.Core.Contracts;

public enum ContractTypeKind { Class, AbstractClass, Interface, Any }

public sealed record ContractType(string Name, ContractTypeKind Kind, IReadOnlyList<string> Members);

public sealed record Contract(IReadOnlyList<ContractType> Types);
