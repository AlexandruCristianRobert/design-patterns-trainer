using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class StatementRegionChecks
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
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(StatementRegionChecks))
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
        Expect.That(made?.GetType() == expected, "handsOutWrongClass", new { type, method, expected = expected.Name, actual = made?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(made, again), "reusesObject", new { type, method });
    }

    [Check("styles-format-their-country")]
    static void StylesFormatTheirCountry()
    {
        var dates = $"{new BritishDates().Format(31, 1, 2026)} {new GermanDates().Format(3, 4, 2026)}";
        var money = $"{new Pounds().Format(125000)} {new Pounds().Format(705)} / {new Euros().Format(125000)} {new Euros().Format(705)}";

        Expect.That(dates == "31/01/2026 03.04.2026", "wrongDates", new { expected = "31/01/2026 03.04.2026", actual = dates });
        Expect.That(money == "£1250.00 £7.05 / 1250,00 € 7,05 €", "wrongMoney", new { expected = "£1250.00 £7.05 / 1250,00 € 7,05 €", actual = money });
    }

    [Check("british-region-hands-out-british-styles")]
    static void BritishRegionHandsOutBritishStyles()
    {
        Region region = new BritishRegion();
        IsNew("BritishRegion", "NewDateStyle", region.NewDateStyle(), region.NewDateStyle(), typeof(BritishDates));
        IsNew("BritishRegion", "NewMoneyStyle", region.NewMoneyStyle(), region.NewMoneyStyle(), typeof(Pounds));
    }

    [Check("german-region-hands-out-german-styles")]
    static void GermanRegionHandsOutGermanStyles()
    {
        Region region = new GermanRegion();
        IsNew("GermanRegion", "NewDateStyle", region.NewDateStyle(), region.NewDateStyle(), typeof(GermanDates));
        IsNew("GermanRegion", "NewMoneyStyle", region.NewMoneyStyle(), region.NewMoneyStyle(), typeof(Euros));
    }

    [Check("printer-uses-one-country")]
    static void PrinterUsesOneCountry()
    {
        var british = new StatementPrinter(new BritishRegion()).Line(3, 4, 2026, "Bakery", 705);
        var german = new StatementPrinter(new GermanRegion()).Line(3, 4, 2026, "Bakery", 705);

        Expect.That(british == "03/04/2026 | Bakery | £7.05", "wrongBritishLine", new { expected = "03/04/2026 | Bakery | £7.05", actual = british });
        Expect.That(german == "03.04.2026 | Bakery | 7,05 €", "wrongGermanLine", new { expected = "03.04.2026 | Bakery | 7,05 €", actual = german });
    }

    [Check("printer-knows-only-region")]
    static void PrinterKnowsOnlyRegion()
    {
        var maker = typeof(Region);
        Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { maker = maker.Name });
        MakingMethod(maker, typeof(IDateStyle));
        MakingMethod(maker, typeof(IMoneyStyle));
        NamesNoConcreteClass("StatementPrinter", typeof(IDateStyle), typeof(IMoneyStyle), maker);
    }
}
