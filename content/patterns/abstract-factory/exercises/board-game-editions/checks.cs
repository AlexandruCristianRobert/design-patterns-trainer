using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BoardGameChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // Every public constructor of `user` takes exactly one thing: an interface or an abstract class that is none of `parts`.
    // That type is what makes the parts, and it is returned.
    static Type Maker(Type user, params Type[] parts)
    {
        var ctors = user.GetConstructors();
        if (ctors.Length == 0) Expect.Fail("noPublicConstructor", new { user = user.Name });
        Type maker = null!;
        foreach (var ctor in ctors)
        {
            var parameters = ctor.GetParameters();
            Expect.That(parameters.Length == 1, "constructorShape", new { user = user.Name, parameters = string.Join(", ", parameters.Select(p => p.ParameterType.Name)) });
            maker = parameters[0].ParameterType;
            Expect.That(!parts.Any(k => k.IsAssignableFrom(maker)), "constructorTakesPart", new { user = user.Name, type = maker.Name });
            Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { user = user.Name, maker = maker.Name });
        }
        return maker;
    }

    // The method `maker` declares that returns a `made`: it takes no parameters, the code that uses `maker` can call it, and each subtype can fill it in.
    static MethodInfo MakingMethod(Type maker, Type made)
    {
        var found = maker.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { maker = maker.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Length == 0);
        if (method is null) Expect.Fail("makingMethodParameters", new { maker = maker.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { maker = maker.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsAssembly || method.IsFamilyOrAssembly, "makingMethodHidden", new { maker = maker.Name, method = method.Name });
        return method;
    }

    // `type` derives from `maker`, and each of `methods` makes a new object of the matching `expected` class on every call.
    static void MakesOneSet(Type type, Type maker, MethodInfo[] methods, params Type[] expected)
    {
        Expect.That(type != maker && maker.IsAssignableFrom(type), "notAMaker", new { type = type.Name, maker = maker.Name });
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        var instance = ctor.Invoke(null);
        for (var i = 0; i < methods.Length; i++)
        {
            var first = methods[i].Invoke(instance, null);
            var second = methods[i].Invoke(instance, null);
            Expect.That(first?.GetType() == expected[i], "makesWrongClass", new { type = type.Name, method = methods[i].Name, expected = expected[i].Name, actual = first?.GetType().Name ?? "null" });
            Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = methods[i].Name });
        }
    }

    // The source of `user` names none of the program's classes that implement or derive from any of `kinds`.
    static void NamesNoConcreteClass(string user, params Type[] kinds)
    {
        var classes = kinds[0].Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(BoardGameChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == user))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "userNamesConcreteClass", new { user, type = named });
        }
    }

    // A GameBox created with a new object of the class called `edition`.
    static GameBox BoxWith(string edition)
    {
        var type = Code.Type(edition).Clr;
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        var instance = ctor.Invoke(null);
        var boxCtor = typeof(GameBox).GetConstructors().FirstOrDefault(c => c.GetParameters() is [var p] && p.ParameterType.IsInstanceOfType(instance));
        if (boxCtor is null) Expect.Fail("boxRefusesEdition", new { type = type.Name });
        return (GameBox)boxCtor.Invoke([instance]);
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Chess: folding wooden board + carved wooden pieces",
            "Draughts: roll-up magnetic board + magnetic pieces",
            "Chess: roll-up magnetic board + magnetic pieces",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("classic-edition-is-all-wood")]
    static void ClassicEditionIsAllWood()
    {
        var line = BoxWith("ClassicEdition").Pack("Test game");

        Expect.That(line == "Test game: folding wooden board + carved wooden pieces", "wrongClassic", new { actual = line });
    }

    [Check("travel-edition-is-all-magnetic")]
    static void TravelEditionIsAllMagnetic()
    {
        var line = BoxWith("TravelEdition").Pack("Test game");

        Expect.That(line == "Test game: roll-up magnetic board + magnetic pieces", "wrongTravel", new { actual = line });
    }

    [Check("box-cannot-mix-editions")]
    static void BoxCannotMixEditions()
    {
        var maker = Maker(typeof(GameBox), typeof(IBoard), typeof(IPieces));
        MethodInfo[] methods = [MakingMethod(maker, typeof(IBoard)), MakingMethod(maker, typeof(IPieces))];
        MakesOneSet(Code.Type("ClassicEdition").Clr, maker, methods, typeof(WoodenBoard), typeof(WoodenPieces));
        MakesOneSet(Code.Type("TravelEdition").Clr, maker, methods, typeof(MagneticBoard), typeof(MagneticPieces));
        NamesNoConcreteClass("GameBox", typeof(IBoard), typeof(IPieces), maker);
    }
}
