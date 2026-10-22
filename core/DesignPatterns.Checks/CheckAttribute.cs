namespace DesignPatterns.Checks;

[AttributeUsage(AttributeTargets.Method)]
public sealed class CheckAttribute(string id) : Attribute
{
    public string Id { get; } = id;
}
