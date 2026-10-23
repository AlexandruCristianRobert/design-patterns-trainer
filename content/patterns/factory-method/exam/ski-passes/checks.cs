using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SkiPassChecks
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
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(SkiPassChecks))
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

    [Check("passes-print-their-style")]
    static void PassesPrintTheirStyle()
    {
        var alpine = new AlpinePass().Print("Ana", 3);
        var nordic = new NordicPass().Print("Zoe", 2);

        Expect.That(alpine == "ALPINE | Ana | 3 days | chip card", "wrongAlpinePass", new { actual = alpine });
        Expect.That(nordic == "NORDIC | Zoe | 2 days | paper ticket", "wrongNordicPass", new { actual = nordic });
    }

    [Check("each-resort-sells-its-own-pass")]
    static void EachResortSellsItsOwnPass()
    {
        var alpine = new AlpineResort().Sell("Ana", 3);
        var nordic = new NordicResort().Sell("Zoe", 2);

        Expect.That(alpine == "ALPINE | Ana | 3 days | chip card | 135 EUR", "wrongAlpineSale", new { actual = alpine });
        Expect.That(nordic == "NORDIC | Zoe | 2 days | paper ticket | 90 EUR", "wrongNordicSale", new { actual = nordic });
    }

    [Check("each-resort-counts-its-sales")]
    static void EachResortCountsItsSales()
    {
        Resort alps = new AlpineResort();
        Resort north = new NordicResort();
        alps.Sell("Ana", 1);
        alps.Sell("Radu", 5);
        north.Sell("Zoe", 2);

        Expect.That(alps.Sold == 2 && north.Sold == 1, "wrongSold", new { alps = alps.Sold, north = north.Sold });
    }

    [Check("resort-knows-only-iskipass")]
    static void ResortKnowsOnlyISkiPass()
    {
        var making = MakingMethod(typeof(Resort), typeof(ISkiPass));
        NoConstructorParameters(typeof(Resort));
        OperationWrittenOnce(typeof(Resort), "Sell", typeof(AlpineResort), typeof(NordicResort));
        NamesNoMadeClass("Resort", typeof(ISkiPass));
        MakesItsOwn(making, typeof(AlpineResort), typeof(AlpinePass));
        MakesItsOwn(making, typeof(NordicResort), typeof(NordicPass));
    }
}
