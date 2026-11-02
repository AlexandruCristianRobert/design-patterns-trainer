using System.Reflection;
using DesignPatterns.Checks;

static class SnowGlobeChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly (string Name, char Symbol, int Speed)[] AllShapes = [("star", '*', 2), ("plate", 'o', 1), ("needle", '|', 3)];

    // Every instance field of `type` and of its base classes.
    static IEnumerable<FieldInfo> Fields(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var f in t.GetFields(Declared)) yield return f;
    }

    // A field's name as the learner wrote it: "Speed" for the field behind the Speed property.
    static string Shown(FieldInfo f) => f.Name.StartsWith('<') ? f.Name[1..f.Name.IndexOf('>')] : f.Name;

    // The first field that could still be assigned after the object is made. The compiler's fields for captured
    // primary-constructor parameters are skipped; the "unchanged by use" part catches a class that assigns one.
    static FieldInfo? Writable(Type type) => Fields(type).FirstOrDefault(f => !f.IsInitOnly && !f.Name.EndsWith(">P"));

    static object?[] Snapshot(object o) => Fields(o.GetType()).Select(f => f.GetValue(o)).ToArray();

    [Check("same-name-same-shape")]
    static void SameNameSameShape()
    {
        var shapes = new FlakeShapes();
        var first = shapes.Get("star");
        var second = shapes.Get("star");

        Expect.That(ReferenceEquals(first, second), "notShared");
        Expect.That(shapes.Created == 1, "createdTwice", new { actual = shapes.Created });
    }

    [Check("each-name-its-own-shape")]
    static void EachNameItsOwnShape()
    {
        var shapes = new FlakeShapes();
        Expect.That(shapes.Created == 0, "createdTooSoon", new { actual = shapes.Created });
        var got = AllShapes.Select(s => shapes.Get(s.Name)).ToArray();

        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = AllShapes[i].Name, second = AllShapes[j].Name });
        for (var i = 0; i < got.Length; i++)
            Expect.That(got[i].Name == AllShapes[i].Name && got[i].Symbol == AllShapes[i].Symbol && got[i].Speed == AllShapes[i].Speed, "wrongShape",
                new { name = AllShapes[i].Name, actual = $"{got[i].Name} {got[i].Symbol}, speed {got[i].Speed}", expected = $"{AllShapes[i].Name} {AllShapes[i].Symbol}, speed {AllShapes[i].Speed}" });
        Expect.That(shapes.Created == 3, "wrongCreated", new { actual = shapes.Created });
    }

    [Check("flakes-fall-at-their-speed")]
    static void FlakesFallAtTheirSpeed()
    {
        var sky = new Sky(new FlakeShapes());
        sky.Drop(4, 20, "star");
        sky.Drop(1, 5, "plate");
        sky.Drop(7, 4, "needle");

        string[] start = ["star * at 4,20", "plate o at 1,5", "needle | at 7,4"];
        string[] once = ["star * at 4,18", "plate o at 1,4", "needle | at 7,1"];
        string[] twice = ["star * at 4,16", "plate o at 1,3", "needle | at 7,0"];
        (int Ticks, string When, string[] Expected)[] stages = [(0, "Before any tick", start), (1, "After 1 tick", once), (2, "After 2 ticks", twice)];
        foreach (var (ticks, when, expected) in stages)
        {
            if (ticks > 0) sky.Tick();
            for (var i = 0; i < expected.Length; i++)
            {
                var actual = sky.Draw(i);
                Expect.That(actual == expected[i], "wrongDraw", new { when, index = i, actual, expected = expected[i] });
            }
        }
    }

    [Check("flakes-share-their-shape")]
    static void FlakesShareTheirShape()
    {
        var shapes = new FlakeShapes();
        var sky = new Sky(shapes);
        for (var i = 0; i < 100; i++)
            sky.Drop(i, 50 + i, i % 2 == 0 ? "star" : "needle");
        sky.Tick();
        var created = shapes.Created;

        Expect.That(created == 2, "skyCreatedShapes", new { actual = created });
        for (var i = 0; i < 100; i++)
        {
            var name = i % 2 == 0 ? "star" : "needle";
            Expect.That(ReferenceEquals(sky.ShapeOf(i), shapes.Get(name)), "notFromShapes", new { index = i, name });
        }
    }

    [Check("shape-never-changes")]
    static void ShapeNeverChanges()
    {
        var writable = Writable(typeof(FlakeShape));
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var shapes = new FlakeShapes();
        var plate = shapes.Get("plate");
        var before = Snapshot(plate);
        var sky = new Sky(shapes);
        sky.Drop(3, 9, "plate");
        sky.Drop(30, 90, "plate");
        sky.Tick();
        sky.Tick();
        sky.Draw(0);
        sky.Draw(1);
        Expect.That(before.SequenceEqual(Snapshot(plate)), "changedByUse");
    }
}
