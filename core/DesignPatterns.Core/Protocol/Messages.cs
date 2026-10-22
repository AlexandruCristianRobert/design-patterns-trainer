using System.Text.Json.Serialization;
using DesignPatterns.Core.Compilation;
using DesignPatterns.Core.Contracts;

namespace DesignPatterns.Core.Protocol;

public enum CompilePurpose
{
    [JsonStringEnumMemberName("diagnostics")] Diagnostics,
    [JsonStringEnumMemberName("run")] Run,
    [JsonStringEnumMemberName("check")] Check
}

public sealed record CompileRequest(string Source, CompilePurpose Purpose, string? ChecksSource = null, Contract? Contract = null);

public sealed record CompileResponse(
    bool Success,
    IReadOnlyList<DiagnosticInfo> Diagnostics,
    IReadOnlyList<ContractViolation> ContractViolations,
    string? AssemblyBase64);

public sealed record LoadRequest(string AssemblyBase64, string Source);

public sealed record LoadResponse(IReadOnlyList<string> CheckIds, bool HasEntryPoint);
