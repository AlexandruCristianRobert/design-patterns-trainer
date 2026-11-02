using System.Reflection;
using DesignPatterns.Checks;

static class MosaicChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every instance field of `type` and of its base classes.
    static IEnumerable<FieldInfo> Fields(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var f in t.GetFields(Declared)) yield return f;
    }

    // A field's name as the learner wrote it: "Cents" for the field behind the Cents property.
    static string Shown(FieldInfo f) => f.Name.StartsWith('<') ? f.Name[1..f.Name.IndexOf('>')] : f.Name;

    // The first field that could still be assigned after the object is made. The compiler's fields for captured
    // primary-constructor parameters are skipped; the "unchanged by use" part catches a class that assigns one.
    static FieldInfo? Writable(Type type) => Fields(type).FirstOrDefault(f => !f.IsInitOnly && !f.Name.EndsWith(">P"));

    static object?[] Snapshot(object o) => Fields(o.GetType()).Select(f => f.GetValue(o)).ToArray();

    [Check("same-colour-and-material-same-kind")]
    static void SameColourAndMaterialSameKind()
    {
        var kinds = new PieceKinds();
        var first = kinds.Get("blue", "glass");
        var second = kinds.Get("blue", "glass");

        Expect.That(ReferenceEquals(first, second), "notShared");
        Expect.That(kinds.Created == 1, "createdTwice", new { actual = kinds.Created });
    }

    [Check("each-pair-its-own-kind")]
    static void EachPairItsOwnKind()
    {
        var kinds = new PieceKinds();
        (string Colour, string Material, int Cents)[] expected = [("blue", "glass", 12), ("blue", "stone", 8), ("red", "glass", 12), ("red", "marble", 25)];
        var got = expected.Select(e => kinds.Get(e.Colour, e.Material)).ToArray();

        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo",
                    new { first = $"{expected[i].Colour} {expected[i].Material}", second = $"{expected[j].Colour} {expected[j].Material}" });
        for (var i = 0; i < got.Length; i++)
            Expect.That(got[i].Colour == expected[i].Colour && got[i].Material == expected[i].Material && got[i].Cents == expected[i].Cents, "wrongKind",
                new { pair = $"{expected[i].Colour} {expected[i].Material}", actual = $"{got[i].Colour} {got[i].Material}, {got[i].Cents} cents", expected = $"{expected[i].Colour} {expected[i].Material}, {expected[i].Cents} cents" });
        Expect.That(kinds.Created == 4, "wrongCreated", new { actual = kinds.Created });
    }

    [Check("mosaic-describes-and-costs")]
    static void MosaicDescribesAndCosts()
    {
        var mosaic = new Mosaic(new PieceKinds());
        mosaic.Place(3, 4, "blue", "glass");
        mosaic.Place(0, 0, "red", "marble");
        mosaic.Place(7, 1, "grey", "stone");
        mosaic.Place(8, 1, "grey", "stone");

        (int X, int Y, string Expected)[] spots = [(3, 4, "blue glass at 3,4"), (0, 0, "red marble at 0,0"), (8, 1, "grey stone at 8,1")];
        foreach (var (x, y, expected) in spots)
        {
            var actual = mosaic.Describe(x, y);
            Expect.That(actual == expected, "wrongDescription", new { x, y, actual, expected });
        }
        var cost = mosaic.Cost();
        Expect.That(cost == 53, "wrongCost", new { actual = cost });
    }

    [Check("pieces-share-kinds")]
    static void PiecesShareKinds()
    {
        var kinds = new PieceKinds();
        var mosaic = new Mosaic(kinds);
        for (var x = 0; x < 10; x++)
            for (var y = 0; y < 10; y++)
                mosaic.Place(x, y, (x + y) % 2 == 0 ? "blue" : "white", "glass");
        var created = kinds.Created;

        Expect.That(created == 2, "mosaicCreatedKinds", new { actual = created });
        for (var x = 0; x < 10; x++)
            for (var y = 0; y < 10; y++)
            {
                var colour = (x + y) % 2 == 0 ? "blue" : "white";
                Expect.That(ReferenceEquals(mosaic.KindAt(x, y), kinds.Get(colour, "glass")), "notFromKinds", new { x, y, colour });
            }
        var cost = mosaic.Cost();
        Expect.That(cost == 1200, "wrongGridCost", new { actual = cost });
    }

    [Check("kind-never-changes")]
    static void KindNeverChanges()
    {
        var writable = Writable(typeof(PieceKind));
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var kinds = new PieceKinds();
        var stone = kinds.Get("grey", "stone");
        var before = Snapshot(stone);
        var mosaic = new Mosaic(kinds);
        mosaic.Place(2, 9, "grey", "stone");
        mosaic.Place(40, 50, "grey", "stone");
        mosaic.Describe(2, 9);
        mosaic.Describe(40, 50);
        mosaic.Cost();
        Expect.That(before.SequenceEqual(Snapshot(stone)), "changedByUse");
    }
}
