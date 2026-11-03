using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ExpeditionChecks
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
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(ExpeditionChecks))
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
        Expect.That(made?.GetType() == expected, "packsWrongClass", new { type, method, expected = expected.Name, actual = made?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(made, again), "reusesObject", new { type, method });
    }

    // `outfitter` packs a new shelter, stove and clothing on every call, all for one climate.
    static void PacksOneClimate(Outfitter outfitter, Type shelter, Type stove, Type clothing)
    {
        var name = outfitter.GetType().Name;
        IsNew(name, "PackShelter", outfitter.PackShelter(), outfitter.PackShelter(), shelter);
        IsNew(name, "PackStove", outfitter.PackStove(), outfitter.PackStove(), stove);
        IsNew(name, "PackClothing", outfitter.PackClothing(), outfitter.PackClothing(), clothing);
    }

    [Check("gear-describes-itself")]
    static void GearDescribesItself()
    {
        IShelter dome = new SnowDome();
        IShelter hammock = new Hammock();
        IStove fuel = new LiquidFuelStove();
        IStove twig = new TwigStove();
        IClothing suit = new DownSuit();
        IClothing shirt = new QuickDryShirt();
        var polar = $"{dome.Name} {dome.Sleeps} / {fuel.Name} {fuel.MinutesToBoil(3)} / {suit.Name}";
        var jungle = $"{hammock.Name} {hammock.Sleeps} / {twig.Name} {twig.MinutesToBoil(3)} / {shirt.Name}";

        Expect.That(polar == "snow dome tent 3 / liquid-fuel stove 18 / down suit", "wrongPolarGear", new { expected = "snow dome tent 3 / liquid-fuel stove 18 / down suit", actual = polar });
        Expect.That(jungle == "jungle hammock 1 / twig stove 27 / quick-dry shirt", "wrongJungleGear", new { expected = "jungle hammock 1 / twig stove 27 / quick-dry shirt", actual = jungle });
    }

    [Check("polar-outfitter-packs-polar-gear")]
    static void PolarOutfitterPacksPolarGear()
    {
        PacksOneClimate(new PolarOutfitter(), typeof(SnowDome), typeof(LiquidFuelStove), typeof(DownSuit));
    }

    [Check("jungle-outfitter-packs-jungle-gear")]
    static void JungleOutfitterPacksJungleGear()
    {
        PacksOneClimate(new JungleOutfitter(), typeof(Hammock), typeof(TwigStove), typeof(QuickDryShirt));
    }

    [Check("expedition-equips-everyone")]
    static void ExpeditionEquipsEveryone()
    {
        var polar = new Expedition(new PolarOutfitter());
        var jungle = new Expedition(new JungleOutfitter());
        var four = polar.Equip(4);
        var three = polar.Equip(3);
        var jungleThree = jungle.Equip(3);

        Expect.That(four == "4 people: 2 x snow dome tent, liquid-fuel stove, 4 x down suit", "wrongPolarFour", new { expected = "4 people: 2 x snow dome tent, liquid-fuel stove, 4 x down suit", actual = four });
        Expect.That(three == "3 people: 1 x snow dome tent, liquid-fuel stove, 3 x down suit", "wrongPolarThree", new { expected = "3 people: 1 x snow dome tent, liquid-fuel stove, 3 x down suit", actual = three });
        Expect.That(jungleThree == "3 people: 3 x jungle hammock, twig stove, 3 x quick-dry shirt", "wrongJungle", new { expected = "3 people: 3 x jungle hammock, twig stove, 3 x quick-dry shirt", actual = jungleThree });
        Expect.That(polar.BoilMinutes(2) == 12 && jungle.BoilMinutes(2) == 18, "wrongBoil", new { polar = polar.BoilMinutes(2), jungle = jungle.BoilMinutes(2) });
    }

    [Check("expedition-knows-only-the-outfitter")]
    static void ExpeditionKnowsOnlyTheOutfitter()
    {
        var maker = typeof(Outfitter);
        Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { maker = maker.Name });
        MakingMethod(maker, typeof(IShelter));
        MakingMethod(maker, typeof(IStove));
        MakingMethod(maker, typeof(IClothing));
        NamesNoConcreteClass("Expedition", typeof(IShelter), typeof(IStove), typeof(IClothing), maker);
    }
}
