namespace DesignPatterns.Checks;

public sealed class CheckFailedException(string reason, IReadOnlyDictionary<string, string> args) : Exception(reason)
{
    public string Reason { get; } = reason;
    public IReadOnlyDictionary<string, string> Args { get; } = args;
}
