using System.Reflection;
using DesignPatterns.Checks;

static class SortingLineChecks
{
    // Links the machines in the order given, with SetNext, and returns the first one.
    static Sorter Line(params Sorter[] machines)
    {
        for (var i = 0; i + 1 < machines.Length; i++)
            machines[i].SetNext(machines[i + 1]);
        return machines[0];
    }

    static Sorter FullLine() => Line(new Magnet(), new Blower(), new GlassEye());

    static string Feed(Sorter first, string name, string material, int grams) =>
        new SortingLine(first).Feed(new Item(name, material, grams));

    [Check("each-item-reaches-its-bin")]
    static void EachItemReachesItsBin()
    {
        var can = Feed(FullLine(), "steel can", "metal", 60);
        Expect.That(can == "steel can goes to the metal bin", "wrongBin",
            new { item = "steel can (metal, 60 g)", expected = "steel can goes to the metal bin", actual = can });

        var napkin = Feed(FullLine(), "paper napkin", "paper", 3);
        Expect.That(napkin == "paper napkin goes to the light bin", "wrongBin",
            new { item = "paper napkin (paper, 3 g)", expected = "paper napkin goes to the light bin", actual = napkin });

        var jar = Feed(FullLine(), "jam jar", "glass", 200);
        Expect.That(jar == "jam jar goes to the glass bin", "wrongBin",
            new { item = "jam jar (glass, 200 g)", expected = "jam jar goes to the glass bin", actual = jar });
    }

    [Check("order-on-the-belt-matters")]
    static void OrderOnTheBeltMatters()
    {
        var magnetFirst = Feed(Line(new Magnet(), new Blower()), "bottle cap", "metal", 4);
        Expect.That(magnetFirst == "bottle cap goes to the metal bin", "wrongFirstTaker",
            new { line = "Magnet, then Blower", expected = "bottle cap goes to the metal bin", actual = magnetFirst });

        var blowerFirst = Feed(Line(new Blower(), new Magnet()), "bottle cap", "metal", 4);
        Expect.That(blowerFirst == "bottle cap goes to the light bin", "wrongFirstTaker",
            new { line = "Blower, then Magnet", expected = "bottle cap goes to the light bin", actual = blowerFirst });

        var glassFirst = Feed(Line(new GlassEye(), new Blower()), "glass bead", "glass", 10);
        Expect.That(glassFirst == "glass bead goes to the glass bin", "wrongFirstTaker",
            new { line = "GlassEye, then Blower", expected = "glass bead goes to the glass bin", actual = glassFirst });
    }

    [Check("leftovers-go-to-general-waste")]
    static void LeftoversGoToGeneralWaste()
    {
        var tub = Feed(FullLine(), "plastic tub", "plastic", 45);
        Expect.That(tub == "plastic tub goes to general waste", "wrongLeftover",
            new { line = "Magnet, Blower, GlassEye", item = "plastic tub (plastic, 45 g)", expected = "plastic tub goes to general waste", actual = tub });

        var alone = Feed(new Blower(), "jam jar", "glass", 200);
        Expect.That(alone == "jam jar goes to general waste", "wrongLeftover",
            new { line = "Blower on its own", item = "jam jar (glass, 200 g)", expected = "jam jar goes to general waste", actual = alone });
    }

    [Check("machines-know-only-the-next")]
    static void MachinesKnowOnlyTheNext()
    {
        var held = typeof(SortingLine).GetFields(AnyField).Count(f => typeof(Sorter).IsAssignableFrom(f.FieldType) || HoldsMany(f.FieldType));
        Expect.That(held == 1, "lineHoldsMore", new { expected = 1, actual = held });

        foreach (var type in typeof(Sorter).Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField | BindingFlags.DeclaredOnly))
                Expect.That(!HoldsMany(field.FieldType), "keptInACollection", new { type = type.Name, field = field.Name });
    }

    const BindingFlags AnyField = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // An array or a collection of machines, such as Sorter[] or List<Sorter>.
    static bool HoldsMany(Type type) =>
        type.GetInterfaces().Append(type).Any(i =>
            i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>)
            && typeof(Sorter).IsAssignableFrom(i.GetGenericArguments()[0]));
}
