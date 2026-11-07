using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class DogShelterChecks
{
    static readonly Dog[] Dogs =
    [
        new Dog("Biscuit", "beagle", true),
        new Dog("Rex", "collie", false),
        new Dog("Mila", "collie", true),
        new Dog("Otto", "boxer", true),
        new Dog("Pip", "beagle", false),
        new Dog("Nala", "boxer", false),
    ];

    static readonly string[] Kinds = ["IsBreed", "CatFriendly", "AllOf", "Not"];

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["family: Mila, Otto", "farmer: Rex"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("each-wish-fits-the-right-dogs")]
    static void EachWishFitsTheRightDogs()
    {
        Try(Make("IsBreed", "collie"), "IsBreed(\"collie\")", "Rex, Mila");
        Try(Make("IsBreed", "boxer"), "IsBreed(\"boxer\")", "Otto, Nala");
        Try(Make("CatFriendly"), "CatFriendly()", "Biscuit, Mila, Otto");
        Try(Make("AllOf", Make("IsBreed", "beagle"), Make("CatFriendly")), "AllOf(IsBreed(\"beagle\"), CatFriendly())", "Biscuit");
        Try(Make("Not", Make("CatFriendly")), "Not(CatFriendly())", "Rex, Pip, Nala");
    }

    [Check("nested-wishes-fit-the-right-dogs")]
    static void NestedWishesFitTheRightDogs()
    {
        Try(Make("AllOf", Make("Not", Make("IsBreed", "collie")), Make("Not", Make("CatFriendly"))),
            "AllOf(Not(IsBreed(\"collie\")), Not(CatFriendly()))", "Pip, Nala");
        Try(Make("Not", Make("AllOf", Make("IsBreed", "collie"), Make("Not", Make("CatFriendly")))),
            "Not(AllOf(IsBreed(\"collie\"), Not(CatFriendly())))", "Biscuit, Mila, Otto, Pip, Nala");
        Try(Make("AllOf", Make("Not", Make("IsBreed", "beagle")), Make("AllOf", Make("CatFriendly"), Make("Not", Make("IsBreed", "collie")))),
            "AllOf(Not(IsBreed(\"beagle\")), AllOf(CatFriendly(), Not(IsBreed(\"collie\"))))", "Otto");
    }

    [Check("each-wish-is-its-own-class")]
    static void EachWishIsItsOwnClass()
    {
        var wish = Code.Type("DogWish").Clr;
        foreach (var type in Kinds.Select(n => Code.Type(n).Clr))
        {
            Expect.That(wish.IsAssignableFrom(type), "notAWish", new { type = type.Name });
            Expect.That(HasOwn(type, "Fits"), "notItsOwn", new { type = type.Name });
        }

        var old = Source.Root.DescendantNodes().OfType<BaseTypeDeclarationSyntax>()
            .FirstOrDefault(d => d.Identifier.ValueText is "Matcher" or "Wish");
        Expect.That(old is null, "oldTypeLeft", new { type = old?.Identifier.ValueText });

        var test = KindTest();
        Expect.That(test is null, "kindTest", new { code = test });
    }

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

    // The type writes the method itself (an override, an interface method or an explicit one), not only inherits it.
    static bool HasOwn(Type type, string method) =>
        type.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly)
            .Any(m => !m.IsAbstract && (m.Name == method || m.Name.EndsWith("." + method)));

    // The first code that tests what kind of object it has: a switch, is, as, typeof or GetType(); null when there is none.
    static string? KindTest(params string[] skip) =>
        Source.Root.DescendantNodes()
            .Where(n => !n.Ancestors().OfType<TypeDeclarationSyntax>().Any(d => skip.Contains(d.Identifier.ValueText)))
            .FirstOrDefault(n => n is SwitchStatementSyntax or SwitchExpressionSyntax or IsPatternExpressionSyntax or TypeOfExpressionSyntax
                || n is BinaryExpressionSyntax { OperatorToken.ValueText: "is" or "as" }
                || n is InvocationExpressionSyntax call && call.Expression.ToString().EndsWith("GetType"))
            ?.ToString().Split('\n')[0].Trim();
}