using System.Reflection;
using DesignPatterns.Checks;

static class FireworksChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly (string Name, string Colour, int Metres)[] AllShells = [("peony", "red", 120), ("willow", "gold", 150), ("crossette", "green", 90)];

    // Every instance field of `type` and of its base classes.
    static IEnumerable<FieldInfo> Fields(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var f in t.GetFields(Declared)) yield return f;
    }

    // A field's name as the learner wrote it: "Colour" for the field behind the Colour property.
    static string Shown(FieldInfo f) => f.Name.StartsWith('<') ? f.Name[1..f.Name.IndexOf('>')] : f.Name;

    // The first field that could still be assigned after the object is made. The compiler's fields for captured
    // primary-constructor parameters are skipped; the "unchanged by use" part catches a class that assigns one.
    static FieldInfo? Writable(Type type) => Fields(type).FirstOrDefault(f => !f.IsInitOnly && !f.Name.EndsWith(">P"));

    static object?[] Snapshot(object o) => Fields(o.GetType()).Select(f => f.GetValue(o)).ToArray();

    [Check("same-name-same-shell")]
    static void SameNameSameShell()
    {
        var rack = new ShellRack();
        var first = rack.Get("peony");
        var second = rack.Get("peony");

        Expect.That(ReferenceEquals(first, second), "notShared");
        Expect.That(rack.Created == 1, "createdTwice", new { actual = rack.Created });
    }

    [Check("each-name-its-own-shell")]
    static void EachNameItsOwnShell()
    {
        var rack = new ShellRack();
        Expect.That(rack.Created == 0, "createdTooSoon", new { actual = rack.Created });
        var got = AllShells.Select(s => rack.Get(s.Name)).ToArray();

        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = AllShells[i].Name, second = AllShells[j].Name });
        for (var i = 0; i < got.Length; i++)
            Expect.That(got[i].Name == AllShells[i].Name && got[i].Colour == AllShells[i].Colour && got[i].Metres == AllShells[i].Metres, "wrongShell",
                new { name = AllShells[i].Name, actual = $"{got[i].Colour} {got[i].Name}, {got[i].Metres} m", expected = $"{AllShells[i].Colour} {AllShells[i].Name}, {AllShells[i].Metres} m" });
        Expect.That(rack.Created == 3, "wrongCreated", new { actual = rack.Created });
    }

    [Check("script-lists-launches-in-time-order")]
    static void ScriptListsLaunchesInTimeOrder()
    {
        var show = new Show(new ShellRack());
        show.Launch(65, 2, "willow");
        show.Launch(5, 3, "peony");
        show.Launch(5, 1, "crossette");
        show.Launch(600, 4, "peony");

        string[] expected = ["0:05 pad 3: red peony, 120 m", "0:05 pad 1: green crossette, 90 m", "1:05 pad 2: gold willow, 150 m", "10:00 pad 4: red peony, 120 m"];
        var actual = show.Script();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "wrongScript", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("launches-share-their-shell")]
    static void LaunchesShareTheirShell()
    {
        var rack = new ShellRack();
        var show = new Show(rack);
        for (var i = 0; i < 60; i++)
            show.Launch(i * 3, i % 8 + 1, i % 2 == 0 ? "willow" : "crossette");
        var created = rack.Created;

        Expect.That(created == 2, "showCreatedShells", new { actual = created });
        for (var i = 0; i < 60; i++)
        {
            var name = i % 2 == 0 ? "willow" : "crossette";
            Expect.That(ReferenceEquals(show.ShellAt(i), rack.Get(name)), "notFromRack", new { index = i, name });
        }
    }

    [Check("shell-never-changes")]
    static void ShellNeverChanges()
    {
        var writable = Writable(typeof(Shell));
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var rack = new ShellRack();
        var willow = rack.Get("willow");
        var before = Snapshot(willow);
        var show = new Show(rack);
        show.Launch(10, 1, "willow");
        show.Launch(200, 6, "willow");
        show.Script();
        Expect.That(before.SequenceEqual(Snapshot(willow)), "changedByUse");
    }
}
