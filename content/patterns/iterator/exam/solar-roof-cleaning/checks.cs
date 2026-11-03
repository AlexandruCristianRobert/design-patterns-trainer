using System.Reflection;
using DesignPatterns.Checks;

static class SolarRoofChecks
{
    // A roof of the given size with a panel in every place, named by row and column, such as "r2c3".
    static SolarRoof Full(int rows, int columns)
    {
        var roof = new SolarRoof(rows, columns);
        for (var row = 1; row <= rows; row++)
            for (var column = 1; column <= columns; column++)
                roof.Mount(row, column, $"r{row}c{column}");
        return roof;
    }

    // The panels a pass meets, such as "r1c1 r1c2", or "(none)".
    static string Path(SolarRoof roof)
    {
        var met = new List<string>();
        foreach (var panel in roof)
        {
            met.Add(panel);
            if (met.Count > 60) break;
        }
        return met.Count == 0 ? "(none)" : string.Join(" ", met);
    }

    static string Step(IEnumerator<string> pass) => pass.MoveNext() ? pass.Current : "(none)";

    [Check("rows-are-cleaned-back-and-forth")]
    static void RowsAreCleanedBackAndForth()
    {
        var three = Path(Full(3, 3));
        const string expected = "r1c1 r1c2 r1c3 r2c3 r2c2 r2c1 r3c1 r3c2 r3c3";
        Expect.That(three == expected, "wrongPath", new { roof = "a full roof of 3 rows and 3 columns", expected, actual = three });

        var wide = Path(Full(2, 4));
        const string expectedWide = "r1c1 r1c2 r1c3 r1c4 r2c4 r2c3 r2c2 r2c1";
        Expect.That(wide == expectedWide, "wrongPath", new { roof = "a full roof of 2 rows and 4 columns", expected = expectedWide, actual = wide });

        var tall = Path(Full(4, 1));
        Expect.That(tall == "r1c1 r2c1 r3c1 r4c1", "wrongPath", new { roof = "a full roof of 4 rows and 1 column", expected = "r1c1 r2c1 r3c1 r4c1", actual = tall });
    }

    [Check("empty-places-are-stepped-over")]
    static void EmptyPlacesAreSteppedOver()
    {
        var roof = Full(3, 3);
        roof.Remove(2, 2);
        roof.Remove(1, 3);
        roof.Remove(3, 1);
        var met = Path(roof);
        const string expected = "r1c1 r1c2 r2c3 r2c1 r3c2 r3c3";
        Expect.That(met == expected, "wrongGaps", new { removed = "r1c3, r2c2 and r3c1", expected, actual = met });

        var sparse = new SolarRoof(3, 4);
        sparse.Mount(2, 1, "west");
        sparse.Mount(2, 4, "east");
        var two = Path(sparse);
        Expect.That(two == "east west", "wrongGaps", new { removed = "all but r2c1 (west) and r2c4 (east)", expected = "east west", actual = two });

        var pass = sparse.GetEnumerator();
        Step(pass);
        Step(pass);
        var after = Step(pass);
        var again = Step(pass);
        Expect.That(after == "(none)" && again == "(none)", "keptGoing", new { actual = after == "(none)" ? again : after });
    }

    [Check("two-passes-keep-their-own-place")]
    static void TwoPassesKeepTheirOwnPlace()
    {
        var roof = Full(2, 2);
        var first = roof.GetEnumerator();
        var second = roof.GetEnumerator();
        Step(first);
        Step(first);
        var a = Step(first);
        var b = Step(second);
        var places = $"{a} / {b}";
        Expect.That(places == "r2c2 / r1c1", "sharedPlace", new { expected = "r2c2 / r1c1", actual = places });

        while (second.MoveNext()) { }
        var next = Step(first);
        Expect.That(next == "r2c1", "disturbedByOther", new { expected = "r2c1", actual = next });
    }

    [Check("an-empty-roof-has-nothing-to-clean")]
    static void AnEmptyRoofHasNothingToClean()
    {
        var bare = Path(new SolarRoof(2, 3));
        Expect.That(bare == "(none)", "wrongEmpty", new { roof = "a roof of 2 by 3 with no panels", expected = "(none)", actual = bare });

        var cleared = new SolarRoof(1, 1);
        cleared.Mount(1, 1, "solo");
        cleared.Remove(1, 1);
        var gone = Path(cleared);
        Expect.That(gone == "(none)", "wrongEmpty", new { roof = "a roof whose only panel was taken off", expected = "(none)", actual = gone });

        var plan = CleaningRobot.Plan(new SolarRoof(2, 2));
        Expect.That(plan == "nothing to clean", "wrongEmptyPlan", new { expected = "nothing to clean", actual = plan });
    }

    [Check("the-robot-plans-the-path")]
    static void TheRobotPlansThePath()
    {
        var roof = new SolarRoof(3, 3);
        roof.Mount(1, 1, "P1");
        roof.Mount(1, 2, "P2");
        roof.Mount(1, 3, "P3");
        roof.Mount(2, 1, "P4");
        roof.Mount(2, 3, "P6");
        roof.Mount(3, 2, "P8");
        var plan = CleaningRobot.Plan(roof);
        Expect.That(plan == "P1 > P2 > P3 > P6 > P4 > P8", "wrongPlan", new { expected = "P1 > P2 > P3 > P6 > P4 > P8", actual = plan });

        var one = new SolarRoof(2, 2);
        one.Mount(2, 2, "Q4");
        var single = CleaningRobot.Plan(one);
        Expect.That(single == "Q4", "wrongPlan", new { expected = "Q4", actual = single });
    }

    [Check("the-roof-keeps-its-places-to-itself")]
    static void TheRoofKeepsItsPlacesToItself()
    {
        var shown = StorageShown(typeof(SolarRoof));
        Expect.That(shown is null, "storageShown", new { member = shown });
    }

    // The first public member of the type that hands out an array or a collection: a field, a property or a method; null when there is none.
    static string? StorageShown(Type type)
    {
        const BindingFlags Public = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static;
        var field = type.GetFields(Public).FirstOrDefault(f => IsStorage(f.FieldType));
        if (field is not null) return field.Name;
        var property = type.GetProperties(Public).FirstOrDefault(p => IsStorage(p.PropertyType));
        if (property is not null) return property.Name;
        return type.GetMethods(Public).FirstOrDefault(m => !m.IsSpecialName && IsStorage(m.ReturnType))?.Name;
    }

    // An array, or a type that can be counted and changed like a list: anything beyond a walk.
    static bool IsStorage(Type type) =>
        type.IsArray
        || typeof(System.Collections.ICollection).IsAssignableFrom(type)
        || type.GetInterfaces().Append(type).Any(i => i.IsGenericType
            && (i.GetGenericTypeDefinition() == typeof(ICollection<>) || i.GetGenericTypeDefinition() == typeof(IReadOnlyCollection<>)));
}
