using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using DesignPatterns.Core.Execution;

namespace DesignPatterns.Core.Protocol;

[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    UseStringEnumConverter = true)]
[JsonSerializable(typeof(CompileRequest))]
[JsonSerializable(typeof(CompileResponse))]
[JsonSerializable(typeof(LoadRequest))]
[JsonSerializable(typeof(LoadResponse))]
[JsonSerializable(typeof(RunOutcome))]
[JsonSerializable(typeof(CheckResult))]
internal sealed partial class ProtocolJsonContext : JsonSerializerContext;

public static class ProtocolJson
{
    public static string Serialize<T>(T value) => JsonSerializer.Serialize(value, TypeInfo<T>());

    public static T Deserialize<T>(string json) => JsonSerializer.Deserialize(json, TypeInfo<T>())!;

    private static JsonTypeInfo<T> TypeInfo<T>() => (JsonTypeInfo<T>?)ProtocolJsonContext.Default.GetTypeInfo(typeof(T))
        ?? throw new InvalidOperationException($"{typeof(T).Name} is not registered in ProtocolJsonContext.");
}
