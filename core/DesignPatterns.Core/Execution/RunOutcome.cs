namespace DesignPatterns.Core.Execution;

public sealed record RunOutcome(string Stdout, bool Truncated, ExceptionInfo? Exception, bool HasEntryPoint);
