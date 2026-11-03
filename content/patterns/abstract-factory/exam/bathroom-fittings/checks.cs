using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BathroomFittingChecks
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
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(BathroomFittingChecks))
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

    // `range` makes a new tap, basin and shower on every call, all of one range.
    static void MakesOneRange(FittingRange range, Type tap, Type basin, Type shower)
    {
        var name = range.GetType().Name;
        IsNew(name, "MakeTap", range.MakeTap(), range.MakeTap(), tap);
        IsNew(name, "MakeBasin", range.MakeBasin(), range.MakeBasin(), basin);
        IsNew(name, "MakeShower", range.MakeShower(), range.MakeShower(), shower);
    }

    static string Show(ITap t, IBasin b, IShower s) => $"{t.Name} {t.Price} / {b.Name} {b.Price} / {s.Name} {s.Price}";

    [Check("fittings-have-name-and-price")]
    static void FittingsHaveNameAndPrice()
    {
        var contemporary = Show(new MixerTap(), new SquareBasin(), new RainShower());
        var heritage = Show(new CrossTap(), new PedestalBasin(), new TelephoneShower());

        Expect.That(contemporary == "chrome mixer tap 90 / square basin 220 / rain shower 310", "wrongContemporaryFittings", new { expected = "chrome mixer tap 90 / square basin 220 / rain shower 310", actual = contemporary });
        Expect.That(heritage == "brass cross tap 140 / pedestal basin 360 / telephone shower 280", "wrongHeritageFittings", new { expected = "brass cross tap 140 / pedestal basin 360 / telephone shower 280", actual = heritage });
    }

    [Check("contemporary-range-makes-contemporary-fittings")]
    static void ContemporaryRangeMakesContemporaryFittings()
    {
        MakesOneRange(new ContemporaryRange(), typeof(MixerTap), typeof(SquareBasin), typeof(RainShower));
    }

    [Check("heritage-range-makes-heritage-fittings")]
    static void HeritageRangeMakesHeritageFittings()
    {
        MakesOneRange(new HeritageRange(), typeof(CrossTap), typeof(PedestalBasin), typeof(TelephoneShower));
    }

    [Check("quote-prices-one-range")]
    static void QuotePricesOneRange()
    {
        var contemporary = new BathroomQuote(new ContemporaryRange()).Quote(2);
        var heritage = new BathroomQuote(new HeritageRange()).Quote(1);

        Expect.That(contemporary == "2 x chrome mixer tap, square basin, rain shower: 710 EUR", "wrongContemporaryQuote", new { expected = "2 x chrome mixer tap, square basin, rain shower: 710 EUR", actual = contemporary });
        Expect.That(heritage == "1 x brass cross tap, pedestal basin, telephone shower: 780 EUR", "wrongHeritageQuote", new { expected = "1 x brass cross tap, pedestal basin, telephone shower: 780 EUR", actual = heritage });
    }

    [Check("quote-knows-only-the-range")]
    static void QuoteKnowsOnlyTheRange()
    {
        var maker = typeof(FittingRange);
        Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { maker = maker.Name });
        MakingMethod(maker, typeof(ITap));
        MakingMethod(maker, typeof(IBasin));
        MakingMethod(maker, typeof(IShower));
        NamesNoConcreteClass("BathroomQuote", typeof(ITap), typeof(IBasin), typeof(IShower), maker);
    }
}
