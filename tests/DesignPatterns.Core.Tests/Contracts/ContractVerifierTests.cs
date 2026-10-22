using DesignPatterns.Core.Compilation;
using DesignPatterns.Core.Contracts;

namespace DesignPatterns.Core.Tests.Contracts;

public class ContractVerifierTests
{
    static IReadOnlyList<ContractViolation> V(string code, params ContractType[] types) =>
        ContractVerifier.Verify(CSharpCompiler.Analyze(code).Compilation, new Contract(types));
    static readonly ContractType IObs = new("IObserver", ContractTypeKind.Interface, ["void Update(int temp)"]);
    const string Obs = "public interface IObserver { void Update(int t); } public class WeatherStation { public void Subscribe(IObserver o) {} }";

    [Fact] public void Satisfied() => Assert.Empty(V(Obs, IObs, new("WeatherStation", ContractTypeKind.Class, ["void Subscribe(IObserver o)"])));
    [Fact] public void MissingType() => Assert.Equal(new ContractViolation(ContractViolationCode.MissingType, "Station"), Assert.Single(V(Obs, new ContractType("Station", ContractTypeKind.Any, []))));
    [Fact] public void WrongKind() => Assert.Equal(ContractViolationCode.WrongKind, Assert.Single(V("public class IObserver { public void Update(int t) {} }", IObs)).Code);
    [Fact] public void MisspelledMember() => Assert.Equal(new ContractViolation(ContractViolationCode.MissingMember, "IObserver", "void Update(int temp)"),
        Assert.Single(V("public interface IObserver { void Updte(int t); }", IObs)));
    [Fact] public void ParameterTypeMismatch() => Assert.Single(V("public interface IObserver { void Update(long t); }", IObs));
    [Fact] public void StaticPropertyRequired() => Assert.Single(V("public class Logger { public Logger Instance { get; } = null!; }",
        new ContractType("Logger", ContractTypeKind.Class, ["static Logger Instance { get; }"])));
    [Fact] public void PublicConstructorRequired()
    {
        var milk = new ContractType("Milk", ContractTypeKind.Class, ["Milk(ICoffee inner)"]);
        Assert.Empty(V("public interface ICoffee {} public class Milk { public Milk(ICoffee inner) {} }", milk));
        Assert.Single(V("public interface ICoffee {} public class Milk { private Milk(ICoffee inner) {} }", milk));
    }
    [Fact] public void NonPublicTypeIsMissing() => Assert.Equal(ContractViolationCode.MissingType, Assert.Single(V("interface IObserver { void Update(int t); }", IObs)).Code);
    [Fact] public void GenericParameterTypes() => Assert.Empty(V("public class Bus { public void Send(List<string> m) {} }",
        new ContractType("Bus", ContractTypeKind.Class, ["void Send(List<string> messages)"])));
}
