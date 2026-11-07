using System.Reflection;
using System.Runtime.CompilerServices;
using DesignPatterns.Checks;

static class SynthPatchChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "cutoff 40, notes C G",
            "cutoff 90, notes C G",
            "cutoff 40, notes C G",
            "cutoff 90, notes C G",
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
        synth.AddNote("A");
        var first = Save(synth);
        synth.SetCutoff(70);
        synth.AddNote("E");
        var second = Save(synth);
        synth.SetCutoff(100);
        synth.AddNote("D");

        Restore(synth, first);
        Step(synth, "saving two patches, changing more and restoring the first one", "cutoff 20, notes A");
        Restore(synth, second);
        Step(synth, "then restoring the second one", "cutoff 70, notes A E");
    }

    [Check("later-changes-do-not-reach-a-saved-patch")]
    static void LaterChangesDoNotReachASavedPatch()
    {
        var synth = new Synth();
        synth.AddNote("C");
        var saved = Save(synth);

        synth.AddNote("F");
        Restore(synth, saved);
        Step(synth, "saving, adding a note and restoring", "cutoff 50, notes C");

        synth.AddNote("G");
        Restore(synth, saved);
        Step(synth, "then adding a note to the restored synth and restoring the same patch again", "cutoff 50, notes C");
    }

    [Check("nothing-else-can-read-a-saved-patch")]
    static void NothingElseCanReadASavedPatch()
    {
        ExpectNoPublicState(typeof(Synth));
        var synth = new Synth();
        synth.AddNote("C");
        ExpectNothingPublicInside(Save(synth));
    }

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

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // The class (and any class of ours it inherits from) has no public field and no public property.
    static void ExpectNoPublicState(Type owner)
    {
        for (var t = owner; t is not null && t.Assembly == owner.Assembly; t = t.BaseType)
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicField", new { type = owner.Name, field = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.GetMethod?.IsPublic == true || p.SetMethod?.IsPublic == true))
                Expect.Fail("publicProperty", new { type = owner.Name, property = property.Name });
        }
    }

    // Only Synth can look inside a saved copy. Every class it is (object and ValueType aside) and every interface it implements
    // (a record's IEquatable of a type of ours aside) is ours, so it cannot be read as a list or dictionary. And every one of those types
    // that code outside can name has no public members, constructors aside. A private nested or internal type cannot
    // be named from outside, so it may have them.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(Synth).Assembly;
        var type = saved.GetType();
        var types = new List<Type>();
        for (var t = type; t is not null && t != typeof(object) && t != typeof(ValueType); t = t.BaseType)
        {
            if (t.Assembly != ours) Expect.Fail("foreignType", new { type = type.Name, other = t.Name });
            types.Add(t);
        }
        foreach (var i in type.GetInterfaces())
        {
            if (i.Assembly == ours) types.Add(i);
            else if (!(i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEquatable<>) && i.GetGenericArguments()[0].Assembly == ours))
                Expect.Fail("foreignType", new { type = type.Name, other = i.Name });
        }
        foreach (var t in types.Where(t => t.IsVisible))
            foreach (var member in PublicMembers(t))
                Expect.Fail("publicInside", new { type = t.Name, member });
    }

    // Public fields (constants aside), properties, methods and events declared on the type. Property accessors,
    // operators and the members the compiler writes for a record are left out.
    static IEnumerable<string> PublicMembers(Type t)
    {
        foreach (var f in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral)) yield return f.Name;
        foreach (var p in t.GetProperties(Declared).Where(p => p.GetMethod?.IsPublic == true || p.SetMethod?.IsPublic == true))
            yield return p.Name;
        foreach (var m in t.GetMethods(Declared).Where(m => m.IsPublic && !m.IsSpecialName && !m.IsDefined(typeof(CompilerGeneratedAttribute))))
            yield return m.Name;
        foreach (var e in t.GetEvents(Declared).Where(e => e.AddMethod?.IsPublic == true)) yield return e.Name;
    }
}
