using System.Reflection;
using DesignPatterns.Checks;

static class KnittingChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every instance field of `type` and of its base classes.
    static IEnumerable<FieldInfo> Fields(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var f in t.GetFields(Declared)) yield return f;
    }

    // A field's name as the learner wrote it: "Name" for the field behind the Name property.
    static string Shown(FieldInfo f) => f.Name.StartsWith('<') ? f.Name[1..f.Name.IndexOf('>')] : f.Name;

    // The first field that could still be assigned after the object is made. The compiler's fields for captured
    // primary-constructor parameters are skipped; the "unchanged by use" part catches a class that assigns one.
    static FieldInfo? Writable(Type type) => Fields(type).FirstOrDefault(f => !f.IsInitOnly && !f.Name.EndsWith(">P"));

    static object?[] Snapshot(object o) => Fields(o.GetType()).Select(f => f.GetValue(o)).ToArray();

    [Check("same-name-same-kind")]
    static void SameNameSameKind()
    {
        var kinds = new StitchKinds();
        var first = kinds.Get("knit");
        var second = kinds.Get("knit");

        Expect.That(ReferenceEquals(first, second), "notShared");
        Expect.That(kinds.Created == 1, "createdTwice", new { actual = kinds.Created });
    }

    [Check("each-name-its-own-kind")]
    static void EachNameItsOwnKind()
    {
        var kinds = new StitchKinds();
        (string Name, char Symbol)[] expected = [("knit", '|'), ("purl", '-'), ("cable", 'X')];
        var got = expected.Select(e => kinds.Get(e.Name)).ToArray();

        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = expected[i].Name, second = expected[j].Name });
        for (var i = 0; i < got.Length; i++)
            Expect.That(got[i].Name == expected[i].Name && got[i].Symbol == expected[i].Symbol, "wrongKind",
                new { name = expected[i].Name, actual = $"{got[i].Name} {got[i].Symbol}", expected = $"{expected[i].Name} {expected[i].Symbol}" });
        Expect.That(kinds.Created == 3, "wrongCreated", new { actual = kinds.Created });
    }

    [Check("chart-uses-the-shared-kinds")]
    static void ChartUsesTheSharedKinds()
    {
        var kinds = new StitchKinds();
        var chart = new Chart(kinds);
        for (var row = 1; row <= 2; row++)
            for (var column = 1; column <= 20; column++)
                chart.Add(row, column, column % 2 == 1 ? "knit" : "purl");
        var created = kinds.Created;

        Expect.That(chart.Count == 40, "wrongCount", new { actual = chart.Count });
        Expect.That(created == 2, "chartCreatedKinds", new { actual = created });
        for (var i = 0; i < 40; i++)
        {
            var name = i % 2 == 0 ? "knit" : "purl";
            Expect.That(ReferenceEquals(chart.KindAt(i), kinds.Get(name)), "notFromKinds", new { index = i, name });
        }
        Expect.That(chart.Describe(0) == "row 1, column 1: knit |", "wrongDescription", new { index = 0, actual = chart.Describe(0), expected = "row 1, column 1: knit |" });
        Expect.That(chart.Describe(21) == "row 2, column 2: purl -", "wrongDescription", new { index = 21, actual = chart.Describe(21), expected = "row 2, column 2: purl -" });
    }

    [Check("kind-never-changes")]
    static void KindNeverChanges()
    {
        var writable = Writable(typeof(StitchKind));
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var kind = new StitchKinds().Get("cable");
        var before = Snapshot(kind);
        kind.Describe(3, 7);
        kind.Describe(90, 140);
        Expect.That(before.SequenceEqual(Snapshot(kind)), "changedByUse");
    }
}
