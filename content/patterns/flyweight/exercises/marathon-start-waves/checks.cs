using System.Reflection;
using DesignPatterns.Checks;

static class MarathonChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly (string Name, string Colour, string Start)[] AllWaves =
        [("elite", "red", "08:30"), ("fast", "blue", "08:45"), ("club", "green", "09:00"), ("fun", "yellow", "09:20")];

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

    // A new Waves, made through its public constructor without parameters.
    static object NewWaves()
    {
        var ctor = Code.Type("Waves").Clr.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noWavesConstructor");
        return ctor.Invoke(null);
    }

    // What waves.Get(name) returns.
    static object GetWave(object waves, string name)
    {
        var wave = Code.Type("Wave").Clr;
        var get = waves.GetType().GetMethod("Get", [typeof(string)]);
        if (get is null || get.ReturnType != wave) Expect.Fail("noGet");
        return get.Invoke(waves, [name])!;
    }

    // A new runner, made through its public constructor (int bib, string name, Wave wave).
    static object NewRunner(int bib, string name, object wave)
    {
        var ctor = Code.Type("Runner").Clr.GetConstructor([typeof(int), typeof(string), Code.Type("Wave").Clr]);
        if (ctor is null) Expect.Fail("noRunnerConstructor");
        return ctor.Invoke([bib, name, wave]);
    }

    // What the runner's public Label() returns.
    static string Label(object runner)
    {
        var label = runner.GetType().GetMethod("Label", Type.EmptyTypes);
        if (label is null || label.ReturnType != typeof(string)) Expect.Fail("noLabel");
        return (string)label.Invoke(runner, null)!;
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Bib 101 Ana: elite wave, red, starts 08:30",
            "Bib 102 Bo: elite wave, red, starts 08:30",
            "Bib 2040 Cy: club wave, green, starts 09:00",
            "Bib 5311 Dee: fun wave, yellow, starts 09:20",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("same-name-same-wave")]
    static void SameNameSameWave()
    {
        Expect.That(!Code.Type("Wave").Clr.IsValueType, "waveNotClass");
        var waves = NewWaves();
        Expect.That(ReferenceEquals(GetWave(waves, "elite"), GetWave(waves, "elite")), "notShared");

        var got = AllWaves.Select(w => GetWave(waves, w.Name)).ToArray();
        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = AllWaves[i].Name, second = AllWaves[j].Name });
    }

    [Check("runners-share-their-wave")]
    static void RunnersShareTheirWave()
    {
        var waves = NewWaves();
        foreach (var (name, colour, start) in AllWaves)
        {
            var wave = GetWave(waves, name);
            var runner = NewRunner(7, "Test runner", wave);
            var expected = $"Bib 7 Test runner: {name} wave, {colour}, starts {start}";
            var actual = Label(runner);
            Expect.That(actual == expected, "wrongLabel", new { wave = name, actual, expected });

            var held = Fields(runner.GetType()).Any(f => ReferenceEquals(f.GetValue(runner), wave));
            Expect.That(held, "holdsNoWave", new { wave = name });
            var copied = Fields(runner.GetType()).FirstOrDefault(f => f.FieldType == typeof(string) && f.GetValue(runner) is string s && (s == colour || s == start));
            Expect.That(copied is null, "keepsWaveDetail", new { field = copied is null ? "" : Shown(copied), value = copied?.GetValue(runner) });
        }
    }

    [Check("wave-never-changes")]
    static void WaveNeverChanges()
    {
        var writable = Writable(Code.Type("Wave").Clr);
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var wave = GetWave(NewWaves(), "club");
        var before = Snapshot(wave);
        Label(NewRunner(1, "First", wave));
        Label(NewRunner(19999, "Last", wave));
        Expect.That(before.SequenceEqual(Snapshot(wave)), "changedByUse");
    }
}
