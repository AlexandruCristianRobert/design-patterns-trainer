namespace DesignPatterns.Core.Execution;

public static class RuntimeLimits
{
    public const int MaxOutputChars = 65_536;
    public const int TimeoutMs = 5_000;
    public const int RecycleAfterLoads = 50;
}
