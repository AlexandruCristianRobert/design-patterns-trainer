using System.Reflection;

namespace DesignPatterns.Checks;

public sealed class TypeFacts
{
    private const BindingFlags All = BindingFlags.Public | BindingFlags.NonPublic;

    internal TypeFacts(Type clr) => Clr = clr;

    public Type Clr { get; }
    public bool IsInterface => Clr.IsInterface;
    public bool IsAbstract => Clr.IsAbstract;
    public bool IsSealed => Clr.IsSealed;

    public IReadOnlyList<ConstructorInfo> Constructors =>
        Clr.GetConstructors(All | BindingFlags.Instance | BindingFlags.DeclaredOnly);

    public IReadOnlyList<FieldInfo> StaticFields =>
        Clr.GetFields(All | BindingFlags.Static | BindingFlags.DeclaredOnly);

    public bool Implements(string interfaceName) =>
        Clr.GetInterfaces().Any(i => i.Name == interfaceName || i.FullName == interfaceName);
}
