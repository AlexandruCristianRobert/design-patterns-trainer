using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class AirlineCabinChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // The method `maker` declares that returns a `made`: it takes `parameters`, the code that uses `maker` can call it, and each subtype can fill it in.
    static MethodInfo MakingMethod(Type maker, Type made, params Type[] parameters)
    {
        var found = maker.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { maker = maker.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Select(p => p.ParameterType).SequenceEqual(parameters));
        if (method is null) Expect.Fail("makingMethodParameters", new { maker = maker.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { maker = maker.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsAssembly || method.IsFamilyOrAssembly, "makingMethodHidden", new { maker = maker.Name, method = method.Name });
        return method;
    }

    // The source of `user` names none of the program's classes that implement or derive from any of `kinds`.
    static void NamesNoConcreteClass(string user, params Type[] kinds)
    {
        var classes = kinds[0].Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(AirlineCabinChecks))
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

    // `cabin` hands out a new seat for the row asked and a new amenity on every call, all from one cabin.
    static void HandsOutOneCabin(Cabin cabin, Type seat, Type amenity)
    {
        var name = cabin.GetType().Name;
        var first = cabin.SeatInRow(7);
        IsNew(name, "SeatInRow", first, cabin.SeatInRow(7), seat);
        Expect.That(first.Row == 7, "wrongRow", new { type = name, row = first.Row });
        IsNew(name, "HandOut", cabin.HandOut(), cabin.HandOut(), amenity);
    }

    [Check("seats-and-amenities-have-names")]
    static void SeatsAndAmenitiesHaveNames()
    {
        ISeat bed = new FlatBedSeat(2);
        ISeat standard = new StandardSeat(31);
        var seats = $"{bed.Name} {bed.Row} / {standard.Name} {standard.Row}";
        var amenities = $"{((IAmenity)new AmenityPouch()).Name} / {((IAmenity)new SnackBox()).Name}";

        Expect.That(seats == "lie-flat bed 2 / standard seat 31", "wrongSeats", new { expected = "lie-flat bed 2 / standard seat 31", actual = seats });
        Expect.That(amenities == "amenity pouch / snack box", "wrongAmenities", new { expected = "amenity pouch / snack box", actual = amenities });
    }

    [Check("business-cabin-hands-out-business-comfort")]
    static void BusinessCabinHandsOutBusinessComfort()
    {
        HandsOutOneCabin(new BusinessCabin(), typeof(FlatBedSeat), typeof(AmenityPouch));
    }

    [Check("economy-cabin-hands-out-economy-comfort")]
    static void EconomyCabinHandsOutEconomyComfort()
    {
        HandsOutOneCabin(new EconomyCabin(), typeof(StandardSeat), typeof(SnackBox));
    }

    [Check("desk-boards-into-one-cabin")]
    static void DeskBoardsIntoOneCabin()
    {
        var business = new BoardingDesk(new BusinessCabin());
        var economy = new BoardingDesk(new EconomyCabin());
        var ana = business.Board("Ana", 2);
        var radu = economy.Board("Radu", 31);
        economy.Board("Zoe", 32);

        Expect.That(ana == "Ana, row 2: lie-flat bed, amenity pouch", "wrongBusinessBoarding", new { expected = "Ana, row 2: lie-flat bed, amenity pouch", actual = ana });
        Expect.That(radu == "Radu, row 31: standard seat, snack box", "wrongEconomyBoarding", new { expected = "Radu, row 31: standard seat, snack box", actual = radu });
        Expect.That(business.Boarded == 1 && economy.Boarded == 2, "wrongBoarded", new { business = business.Boarded, economy = economy.Boarded });
    }

    [Check("desk-knows-only-the-cabin")]
    static void DeskKnowsOnlyTheCabin()
    {
        var maker = typeof(Cabin);
        Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { maker = maker.Name });
        MakingMethod(maker, typeof(ISeat), typeof(int));
        MakingMethod(maker, typeof(IAmenity));
        NamesNoConcreteClass("BoardingDesk", typeof(ISeat), typeof(IAmenity), maker);
    }
}
