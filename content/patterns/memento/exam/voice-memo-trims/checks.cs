using System.Reflection;
using DesignPatterns.Checks;

static class VoiceMemoChecks
{
    static VoiceMemo Memo(params int[] levels)
    {
        var memo = new VoiceMemo();
        foreach (var level in levels) memo.Record(level);
        return memo;
    }

    static void Step(VoiceMemo memo, Action edit, string said, string expected)
    {
        edit();
        var actual = memo.Show();
        Expect.That(actual == expected, "wrongLevels", new { step = said, expected, actual });
    }

    [Check("each-edit-changes-the-recording")]
    static void EachEditChangesTheRecording()
    {
        var memo = Memo();
        Step(memo, () => { }, "making a new memo", "(empty)");
        memo = Memo(30, 60, 45, 0, 15);
        Step(memo, () => { }, "recording 30 60 45 0 15", "30 60 45 0 15");
        Step(memo, memo.Normalize, "normalizing", "50 100 75 0 25");
        Step(memo, () => memo.Silence(3, 5), "then silencing 5 levels from position 3", "50 100 75 0 0");
        Step(memo, () => memo.Silence(0, 1), "then silencing 1 level from position 0", "0 100 75 0 0");
        Step(memo, () => memo.Cut(1, 2), "then cutting 2 levels from position 1", "0 0 0");
        Step(memo, memo.Normalize, "then normalizing a silent memo", "0 0 0");
        Step(memo, () => memo.Cut(1, 10), "then cutting 10 levels from position 1", "0");
    }

    [Check("undo-puts-back-the-recording-before-each-edit")]
    static void UndoPutsBackTheRecordingBeforeEachEdit()
    {
        var memo = Memo(8, 16, 4, 12);
        var editor = new MemoEditor(memo);
        Step(memo, editor.Normalize, "normalizing 8 16 4 12 in the editor", "50 100 25 75");
        Step(memo, () => editor.Silence(1, 2), "then silencing 2 levels from position 1", "50 0 0 75");
        Step(memo, () => editor.Cut(0, 1), "then cutting 1 level from position 0", "0 0 75");
        Step(memo, editor.Normalize, "then normalizing", "0 0 100");
        Step(memo, editor.Undo, "one undo", "0 0 75");
        Step(memo, editor.Undo, "a second undo", "50 0 0 75");
        Step(memo, editor.Undo, "a third undo", "50 100 25 75");
        Step(memo, editor.Undo, "a fourth undo", "8 16 4 12");
        Step(memo, editor.Undo, "a fifth undo, with no edit left", "8 16 4 12");
    }

    [Check("a-saved-point-stays-as-it-was")]
    static void ASavedPointStaysAsItWas()
    {
        var memo = Memo(10, 20);
        var point = memo.Save();
        memo.Silence(0, 1);
        memo.Record(30);
        Step(memo, () => memo.Restore(point), "saving 10 20, silencing the first level, recording 30 and restoring", "10 20");
        memo.Normalize();
        memo.Cut(0, 1);
        Step(memo, () => memo.Restore(point), "then editing the restored memo and restoring the same point again", "10 20");
    }

    [Check("nothing-else-can-read-an-undo-point")]
    static void NothingElseCanReadAnUndoPoint() => ExpectNothingPublicInside(Memo(10, 20).Save());

    [Check("the-memo-keeps-its-levels-to-itself")]
    static void TheMemoKeepsItsLevelsToItself() => ExpectKeepsItsOwn(typeof(VoiceMemo));

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(VoiceMemo).Assembly;
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
