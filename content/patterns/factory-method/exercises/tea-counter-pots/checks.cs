using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class TeaCounterChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // No constructor of `owner` takes parameters, so nothing can be handed in from outside for it to use.
    static void NoConstructorParameters(Type owner)
    {
        var ctor = owner.GetConstructors(Instance).FirstOrDefault(c => c.GetParameters().Length > 0);
        Expect.That(ctor is null, "ownerTakesParameters", new { owner = owner.Name, parameters = ctor is null ? "" : string.Join(", ", ctor.GetParameters().Select(p => p.ParameterType.Name)) });
    }

    // The method `owner` declares that returns a `made`: abstract or virtual, public or protected, taking `parameters`.
    static MethodInfo MakingMethod(Type owner, Type made, params Type[] parameters)
    {
        var found = owner.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { owner = owner.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Select(p => p.ParameterType).SequenceEqual(parameters));
        if (method is null) Expect.Fail("makingMethodParameters", new { owner = owner.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { owner = owner.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsFamily || method.IsFamilyOrAssembly, "makingMethodPrivate", new { owner = owner.Name, method = method.Name });
        return method;
    }

    // Each subclass derives from `owner`, and neither it nor a class between them declares its own `operation`.
    static void OperationWrittenOnce(Type owner, string operation, params Type[] subclasses)
    {
        foreach (var sub in subclasses)
        {
            Expect.That(sub != owner && owner.IsAssignableFrom(sub), "notASubclass", new { type = sub.Name, owner = owner.Name });
            for (var t = sub; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Instance | BindingFlags.DeclaredOnly).Any(m => m.Name == operation),
                    "operationRedeclared", new { type = t.Name, method = operation });
        }
    }

    // The source of `owner` names none of the program's classes that implement `made`.
    static void NamesNoMadeClass(string owner, Type made)
    {
        var classes = made.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(TeaCounterChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == owner))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "ownerNamesMadeClass", new { owner, type = named });
        }
    }

    // Asks a new `type` twice through `making` and expects two new objects of class `expected`.
    static void MakesItsOwn(MethodInfo making, Type type, Type expected)
    {
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        var instance = ctor.Invoke(null);
        var first = making.Invoke(instance, null);
        var second = making.Invoke(instance, null);
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type = type.Name, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = making.Name });
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "cup 1: green tea, cup 2: green tea (4 min)",
            "cup 1: black tea, cup 2: black tea, cup 3: black tea (12 min)",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("counters-serve-any-number-of-cups")]
    static void CountersServeAnyNumberOfCups()
    {
        var green = new GreenTeaCounter().Serve(1);
        var black = new BlackTeaCounter().Serve(4);

        Expect.That(green == "cup 1: green tea (2 min)", "wrongGreen", new { actual = green });
        Expect.That(black == "cup 1: black tea, cup 2: black tea, cup 3: black tea, cup 4: black tea (16 min)", "wrongBlack", new { actual = black });
    }

    [Check("serve-is-written-once")]
    static void ServeIsWrittenOnce()
    {
        OperationWrittenOnce(typeof(TeaCounter), "Serve", typeof(GreenTeaCounter), typeof(BlackTeaCounter));
    }

    [Check("each-counter-picks-its-pot")]
    static void EachCounterPicksItsPot()
    {
        var making = MakingMethod(typeof(TeaCounter), typeof(ITeaPot));
        NoConstructorParameters(typeof(TeaCounter));
        NamesNoMadeClass("TeaCounter", typeof(ITeaPot));
        MakesItsOwn(making, typeof(GreenTeaCounter), typeof(GreenTeaPot));
        MakesItsOwn(making, typeof(BlackTeaCounter), typeof(BlackTeaPot));
    }
}
