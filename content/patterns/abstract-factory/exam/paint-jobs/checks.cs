using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PaintJobChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

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

    // The source of `user` names none of the program's classes that implement or derive from any of `kinds`.
    static void NamesNoConcreteClass(string user, params Type[] kinds)
    {
        var classes = kinds[0].Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(PaintJobChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == user))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "userNamesConcreteClass", new { user, type = named });
        }
    }

    // `made` is a new object of class `expected`, not the same one as `again`.
    static void IsNew(string type, string method, object? made, object? again, Type expected)
    {
        Expect.That(made?.GetType() == expected, "makesWrongClass", new { type, method, expected = expected.Name, actual = made?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(made, again), "reusesObject", new { type, method });
    }

    static string Show(IPrimer p, ITopcoat t) => $"{p.Name} {p.SquareMetresPerLitre} / {t.Name} {t.SquareMetresPerLitre}";

    [Check("paints-have-name-and-coverage")]
    static void PaintsHaveNameAndCoverage()
    {
        var water = Show(new AcrylicPrimer(), new MattEmulsion());
        var oil = Show(new OilPrimer(), new OilGloss());

        Expect.That(water == "acrylic primer 10 / matt emulsion 12", "wrongWaterPaints", new { actual = water });
        Expect.That(oil == "oil primer 8 / oil gloss 15", "wrongOilPaints", new { actual = oil });
    }

    [Check("water-based-makes-water-based-coats")]
    static void WaterBasedMakesWaterBasedCoats()
    {
        PaintSystem system = new WaterBased();
        IsNew("WaterBased", "NewPrimer", system.NewPrimer(), system.NewPrimer(), typeof(AcrylicPrimer));
        IsNew("WaterBased", "NewTopcoat", system.NewTopcoat(), system.NewTopcoat(), typeof(MattEmulsion));
    }

    [Check("oil-based-makes-oil-based-coats")]
    static void OilBasedMakesOilBasedCoats()
    {
        PaintSystem system = new OilBased();
        IsNew("OilBased", "NewPrimer", system.NewPrimer(), system.NewPrimer(), typeof(OilPrimer));
        IsNew("OilBased", "NewTopcoat", system.NewTopcoat(), system.NewTopcoat(), typeof(OilGloss));
    }

    [Check("order-rounds-up-each-coat")]
    static void OrderRoundsUpEachCoat()
    {
        var water = new PaintJob(new WaterBased()).Order(30);
        var oil = new PaintJob(new OilBased()).Order(30);
        var exact = new PaintJob(new WaterBased()).Order(120);

        Expect.That(water == "30 sq m: 3 L acrylic primer + 3 L matt emulsion", "wrongWaterOrder", new { actual = water });
        Expect.That(oil == "30 sq m: 4 L oil primer + 2 L oil gloss", "wrongOilOrder", new { actual = oil });
        Expect.That(exact == "120 sq m: 12 L acrylic primer + 10 L matt emulsion", "wrongExactOrder", new { actual = exact });
    }

    [Check("job-knows-only-the-paint-system")]
    static void JobKnowsOnlyThePaintSystem()
    {
        var maker = typeof(PaintSystem);
        Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { maker = maker.Name });
        MakingMethod(maker, typeof(IPrimer));
        MakingMethod(maker, typeof(ITopcoat));
        NamesNoConcreteClass("PaintJob", typeof(IPrimer), typeof(ITopcoat), maker);
    }
}
