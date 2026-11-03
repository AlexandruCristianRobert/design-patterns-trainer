using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class DogShelterChecks
{
    static readonly Dog[] Dogs =
    [
        new Dog("Biscuit", "beagle", 2, true),
        new Dog("Rex", "collie", 7, false),
        new Dog("Mila", "collie", 1, true),
        new Dog("Otto", "boxer", 4, true),
        new Dog("Pip", "beagle", 9, false),
        new Dog("Nala", "boxer", 3, false),
    ];

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["family: Biscuit, Mila", "farmer: Rex, Mila, Otto"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("each-simple-wish-fits-the-right-dogs")]
    static void EachSimpleWishFitsTheRightDogs()
    {
        Try(Make("IsBreed", "collie"), "IsBreed(\"collie\")", "Rex, Mila");
        Try(Make("IsBreed", "boxer"), "IsBreed(\"boxer\")", "Otto, Nala");
        Try(Make("YoungerThan", 3), "YoungerThan(3)", "Biscuit, Mila");
        Try(Make("YoungerThan", 5), "YoungerThan(5)", "Biscuit, Mila, Otto, Nala");
        Try(Make("CatFriendly"), "CatFriendly()", "Biscuit, Mila, Otto");
    }

    [Check("combined-wishes-fit-the-right-dogs")]
    static void CombinedWishesFitTheRightDogs()
    {
        Try(Make("AllOf", Make("IsBreed", "beagle"), Make("CatFriendly")), "AllOf(IsBreed(\"beagle\"), CatFriendly())", "Biscuit");
        Try(Make("AnyOf", Make("IsBreed", "boxer"), Make("YoungerThan", 2)), "AnyOf(IsBreed(\"boxer\"), YoungerThan(2))", "Mila, Otto, Nala");
        Try(Make("Not", Make("CatFriendly")), "Not(CatFriendly())", "Rex, Pip, Nala");
    }

    [Check("nested-wishes-fit-the-right-dogs")]
    static void NestedWishesFitTheRightDogs()
    {
        Try(Make("AllOf", Make("Not", Make("IsBreed", "collie")), Make("AnyOf", Make("YoungerThan", 3), Make("Not", Make("CatFriendly")))),
            "AllOf(Not(IsBreed(\"collie\")), AnyOf(YoungerThan(3), Not(CatFriendly())))", "Biscuit, Pip, Nala");
        Try(Make("AnyOf", Make("AllOf", Make("IsBreed", "collie"), Make("CatFriendly")),
                Make("AllOf", Make("Not", Make("YoungerThan", 4)), Make("Not", Make("IsBreed", "beagle")))),
            "AnyOf(AllOf(IsBreed(\"collie\"), CatFriendly()), AllOf(Not(YoungerThan(4)), Not(IsBreed(\"beagle\"))))", "Rex, Mila, Otto");
        Try(Make("Not", Make("AnyOf", Make("IsBreed", "beagle"), Make("AllOf", Make("YoungerThan", 4), Make("CatFriendly")))),
            "Not(AnyOf(IsBreed(\"beagle\"), AllOf(YoungerThan(4), CatFriendly())))", "Rex, Otto, Nala");
    }

    [Check("each-wish-works-out-its-own-fit")]
    static void EachWishWorksOutItsOwnFit()
    {
        var wish = Code.Type("DogWish").Clr;
        foreach (var name in Kinds)
            Expect.That(WorksItOut(Code.Type(name).Clr, wish, "Fits"), "notItsOwnFit", new { type = name });

        var old = Source.Root.DescendantNodes().OfType<BaseTypeDeclarationSyntax>()
            .FirstOrDefault(d => d.Identifier.ValueText is "Matcher" or "Wish");
        Expect.That(old is null, "oldTypeLeft", new { type = old?.Identifier.ValueText });

        var test = TypeTest(Kinds);
        Expect.That(test is null, "typeTest", new { code = test });
    }

    static readonly string[] Kinds = ["IsBreed", "YoungerThan", "CatFriendly", "AllOf", "AnyOf", "Not"];

    // Asks the wish about each of the six dogs and compares the names of those that fit.
    static void Try(object wish, string written, string expected)
    {
        var fits = Code.Type("DogWish").Clr.GetMethod("Fits", [typeof(Dog)]);
        if (fits is null) Expect.Fail("noFits");
        var names = Dogs.Where(d => (bool)fits.Invoke(wish, [d])!).Select(d => d.Name).ToList();
        var actual = names.Count == 0 ? "none" : string.Join(", ", names);
        Expect.That(actual == expected, "wrongDogs", new { wish = written, expected, actual });
    }

    // A new wish of the named type, made with a public constructor that takes these arguments.
    static object Make(string type, params object[] args)
    {
        var ctor = Code.Type(type).Clr.GetConstructors().FirstOrDefault(c =>
        {
            var ps = c.GetParameters();
            return ps.Length == args.Length && ps.Select((p, i) => p.ParameterType.IsAssignableFrom(args[i].GetType())).All(ok => ok);
        });
        if (ctor is null) Expect.Fail("noConstructor", new { type, count = args.Length });
        return ctor.Invoke(args);
    }

    // The class works out its own answer: the method is written in the class, or in a class of its own between it and the base.
    static bool WorksItOut(Type type, Type @base, string method)
    {
        if (!@base.IsAssignableFrom(type)) return false;
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType != @base && found.DeclaringType != typeof(object);
    }

    // The first piece of code that tests whether something is one of the named classes; null when there is none.
    static string? TypeTest(string[] names)
    {
        static string Name(SyntaxNode? n) => n switch
        {
            QualifiedNameSyntax q => q.Right.Identifier.ValueText,
            SimpleNameSyntax s => s.Identifier.ValueText,
            _ => "",
        };

        foreach (var node in Source.Root.DescendantNodes())
        {
            SyntaxNode? named = node switch
            {
                BinaryExpressionSyntax b when b.OperatorToken.ValueText is "is" or "as" => b.Right,
                DeclarationPatternSyntax d => d.Type,
                RecursivePatternSyntax r => r.Type,
                TypePatternSyntax t => t.Type,
                ConstantPatternSyntax c => c.Expression,
                CaseSwitchLabelSyntax c => c.Value,
                TypeOfExpressionSyntax t => t.Type,
                _ => null,
            };
            if (named is not null && names.Contains(Name(named))) return node.ToString();
        }
        return null;
    }
}
