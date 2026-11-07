using System.Reflection;
using DesignPatterns.Checks;

static class HobChecks
{
    // The three levels, such as "5 8 9".
    static string Levels(Hob hob) => string.Join(" ", hob.Zones.Select(z => z.Level));

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["zones 0 0 0, hood 0", "zones 5 0 0, hood 1", "zones 5 9 0, hood 2", "zones 5 8 9, hood 3", "zones 0 8 9, hood 2"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("only-one-zone-boosts")]
    static void OnlyOneZoneBoosts()
    {
        var hob = new Hob();
        Expect.That(hob.Zones.Count == 3, "wrongZoneCount", new { expected = 3, actual = hob.Zones.Count });
        (int Zone, int Level, string Levels)[] steps = [(0, 9, "9 0 0"), (1, 9, "8 9 0"), (1, 4, "8 4 0"), (2, 9, "8 4 9"), (0, 7, "7 4 9")];
        foreach (var (zone, level, expected) in steps)
        {
            hob.Zones[zone].SetLevel(level);
            var actual = Levels(hob);
            Expect.That(actual == expected, "wrongLevels", new { zone = zone + 1, level, expected, actual });
        }
    }

    [Check("the-hood-counts-the-zones-that-are-on")]
    static void TheHoodCountsTheZonesThatAreOn()
    {
        var hob = new Hob();
        (int Zone, int Level, int Hood)[] steps = [(1, 3, 1), (2, 6, 2), (0, 1, 3), (2, 0, 2), (1, 0, 1), (0, 0, 0)];
        foreach (var (zone, level, expected) in steps)
        {
            hob.Zones[zone].SetLevel(level);
            var actual = hob.Hood.Speed;
            Expect.That(actual == expected, "wrongHood", new { zone = zone + 1, level, levels = Levels(hob), expected, actual });
        }
    }

    [Check("the-hob-parts-know-only-the-hob")]
    static void TheHobPartsKnowOnlyTheHob()
    {
        Type[] parts = [typeof(CookingZone), typeof(ExtractorHood)];
        foreach (var part in parts)
            foreach (var field in part.GetFields(AnyField))
                foreach (var other in parts)
                    Expect.That(!Holds(field.FieldType, other), "holdsAnother", new { type = part.Name, field = Shown(field), other = other.Name });
    }

    const BindingFlags AnyField = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A field holds a part when it is typed as that part, or as an array or collection of them.
    static bool Holds(Type fieldType, Type part) =>
        part.IsAssignableFrom(fieldType)
        || fieldType.HasElementType && Holds(fieldType.GetElementType()!, part)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, part));

    // The field's name as written: "<hob>P" and "<Level>k__BackingField" become "hob" and "Level".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
