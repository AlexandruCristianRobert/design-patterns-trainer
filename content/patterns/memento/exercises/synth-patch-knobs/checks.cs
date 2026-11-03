using System.Reflection;
using DesignPatterns.Checks;

static class SynthPatchChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "cutoff 40, resonance 0, steps C - G - - - - -",
            "cutoff 90, resonance 70, steps C - G - - - - -",
            "cutoff 40, resonance 0, steps C - G - - - - -",
            "cutoff 90, resonance 70, steps C - G - - - - -",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    static void Step(Synth synth, string said, string expected)
    {
        var actual = synth.Describe();
        Expect.That(actual == expected, "wrongSound", new { step = said, expected, actual });
    }

    [Check("restore-brings-back-the-saved-sound")]
    static void RestoreBringsBackTheSavedSound()
    {
        var synth = new Synth();
        synth.SetCutoff(20);
        synth.SetStep(0, "A");
        var first = Save(synth);
        synth.SetResonance(35);
        synth.SetStep(7, "E");
        var second = Save(synth);
        synth.SetCutoff(100);
        synth.SetStep(3, "D");

        Restore(synth, second);
        Step(synth, "saving two patches, changing more and restoring the second one", "cutoff 20, resonance 35, steps A - - - - - - E");
        Restore(synth, first);
        Step(synth, "then restoring the first one", "cutoff 20, resonance 0, steps A - - - - - - -");
        Restore(synth, second);
        Step(synth, "then restoring the second one again", "cutoff 20, resonance 35, steps A - - - - - - E");
    }

    [Check("later-changes-do-not-reach-a-saved-patch")]
    static void LaterChangesDoNotReachASavedPatch()
    {
        var synth = new Synth();
        synth.SetStep(0, "C");
        synth.SetStep(4, "F");
        var saved = Save(synth);

        synth.SetStep(0, "B");
        synth.SetStep(1, "D");
        synth.SetCutoff(80);
        Restore(synth, saved);
        Step(synth, "saving, changing two steps and the cutoff, and restoring", "cutoff 50, resonance 0, steps C - - - F - - -");

        synth.SetStep(4, "G");
        synth.SetStep(6, "A");
        Restore(synth, saved);
        Step(synth, "then changing steps of the restored synth and restoring the same patch again", "cutoff 50, resonance 0, steps C - - - F - - -");
    }

    [Check("nothing-else-can-read-a-saved-patch")]
    static void NothingElseCanReadASavedPatch()
    {
        var synth = new Synth();
        synth.SetStep(0, "C");
        ExpectNothingPublicInside(Save(synth));
    }

    [Check("the-synth-keeps-its-sound-to-itself")]
    static void TheSynthKeepsItsSoundToItself() => ExpectKeepsItsOwn(typeof(Synth));

    // ---- Save and Restore, found by name ----

    // `Save()`: public, without parameters, returning something.
    static object Save(Synth synth)
    {
        var save = typeof(Synth).GetMethod("Save", BindingFlags.Public | BindingFlags.Instance, Type.EmptyTypes);
        if (save is null || save.ReturnType == typeof(void)) Expect.Fail("noSave");
        var saved = save.Invoke(synth, null);
        if (saved is null) Expect.Fail("savedNull");
        return saved;
    }

    // `Restore(patch)`: public, with one parameter that takes what `Save()` returned.
    static void Restore(Synth synth, object saved)
    {
        var restore = typeof(Synth).GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(m => m.Name == "Restore" && m.GetParameters() is [var p] && p.ParameterType.IsInstanceOfType(saved));
        if (restore is null) Expect.Fail("noRestore", new { type = saved.GetType().Name });
        restore.Invoke(synth, [saved]);
    }

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(Synth).Assembly;
        var type = saved.GetType();
        Expect.That(type.Assembly == ours, "notOurs", new { type = type.Name });
        var types = new List<Type>();
        for (var t = type; t is not null && t.Assembly == ours; t = t.BaseType) types.Add(t);
        types.AddRange(type.GetInterfaces().Where(i => i.Assembly == ours));
        foreach (var t in types.Where(t => t.IsVisible))
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicInside", new { type = t.Name, member = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.GetMethod?.IsPublic == true || p.SetMethod?.IsPublic == true))
                Expect.Fail("publicInside", new { type = t.Name, member = property.Name });
        }
    }

    // ---- The class keeps what it holds to itself ----

    // Neither the class nor a class of ours it inherits from has a public field (constants aside) or a public property
    // with a public set or init.
    static void ExpectKeepsItsOwn(Type owner)
    {
        for (var t = owner; t is not null && t.Assembly == owner.Assembly; t = t.BaseType)
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicField", new { type = owner.Name, field = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.SetMethod?.IsPublic == true))
                Expect.Fail("publicSetter", new { type = owner.Name, property = property.Name });
        }
    }
}
