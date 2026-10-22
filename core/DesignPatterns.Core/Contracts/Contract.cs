using System.Text.Json.Serialization;

namespace DesignPatterns.Core.Contracts;

public enum ContractTypeKind { [JsonStringEnumMemberName("class")] Class, [JsonStringEnumMemberName("abstractClass")] AbstractClass, [JsonStringEnumMemberName("interface")] Interface, [JsonStringEnumMemberName("any")] Any }

public sealed record ContractType(string Name, ContractTypeKind Kind, IReadOnlyList<string> Members);

public sealed record Contract(IReadOnlyList<ContractType> Types);
