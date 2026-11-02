using System.Reflection;
using DesignPatterns.Checks;

static class SeedTrayChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly (string Name, int Days)[] AllVarieties = [("basil", 7), ("tomato", 10), ("marigold", 5)];

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

    [Check("same-name-same-variety")]
    static void SameNameSameVariety()
    {
        var varieties = new Varieties();
        var first = varieties.Get("basil");
        var second = varieties.Get("basil");

        Expect.That(ReferenceEquals(first, second), "notShared");
        Expect.That(varieties.Created == 1, "createdTwice", new { actual = varieties.Created });
    }

    [Check("each-name-its-own-variety")]
    static void EachNameItsOwnVariety()
    {
        var varieties = new Varieties();
        Expect.That(varieties.Created == 0, "createdTooSoon", new { actual = varieties.Created });
        var got = AllVarieties.Select(v => varieties.Get(v.Name)).ToArray();

        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = AllVarieties[i].Name, second = AllVarieties[j].Name });
        for (var i = 0; i < got.Length; i++)
            Expect.That(got[i].Name == AllVarieties[i].Name && got[i].DaysToSprout == AllVarieties[i].Days, "wrongVariety",
                new { name = AllVarieties[i].Name, actual = $"{got[i].Name}, {got[i].DaysToSprout}", expected = $"{AllVarieties[i].Name}, {AllVarieties[i].Days}" });
        Expect.That(varieties.Created == 3, "wrongCreated", new { actual = varieties.Created });
    }

    [Check("tray-tells-when-seeds-sprout")]
    static void TrayTellsWhenSeedsSprout()
    {
        var tray = new Tray(new Varieties());
        tray.Sow(1, "basil", 5);
        tray.Sow(2, "tomato", 5);
        tray.Sow(3, "marigold", 7);

        (int Cell, int Today, string Expected)[] cases =
        [
            (1, 11, "cell 1: basil, sprouts on day 12"),
            (1, 12, "cell 1: basil, sprouted"),
            (2, 12, "cell 2: tomato, sprouts on day 15"),
            (3, 20, "cell 3: marigold, sprouted"),
        ];
        foreach (var (cell, today, expected) in cases)
        {
            var actual = tray.Status(cell, today);
            Expect.That(actual == expected, "wrongStatus", new { cell, today, actual, expected });
        }
    }

    [Check("seedlings-share-their-variety")]
    static void SeedlingsShareTheirVariety()
    {
        var varieties = new Varieties();
        var tray = new Tray(varieties);
        for (var cell = 1; cell <= 40; cell++)
            tray.Sow(cell, cell % 2 == 0 ? "basil" : "tomato", cell);
        var created = varieties.Created;

        Expect.That(created == 2, "trayCreatedVarieties", new { actual = created });
        for (var cell = 1; cell <= 40; cell++)
        {
            var name = cell % 2 == 0 ? "basil" : "tomato";
            Expect.That(ReferenceEquals(tray.VarietyIn(cell), varieties.Get(name)), "notFromVarieties", new { cell, name });
        }
    }

    [Check("variety-never-changes")]
    static void VarietyNeverChanges()
    {
        var writable = Writable(typeof(Variety));
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var varieties = new Varieties();
        var marigold = varieties.Get("marigold");
        var before = Snapshot(marigold);
        var tray = new Tray(varieties);
        tray.Sow(1, "marigold", 2);
        tray.Sow(2, "marigold", 30);
        tray.Status(1, 3);
        tray.Status(2, 40);
        Expect.That(before.SequenceEqual(Snapshot(marigold)), "changedByUse");
    }
}
