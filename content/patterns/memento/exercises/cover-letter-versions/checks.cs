using System.Reflection;
using DesignPatterns.Checks;

static class CoverLetterChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Dear Ms Novak, / I would like to apply for the baker job. / Kind regards,",
            "Dear Ms Novak, / I am writing about the baker job. / I have baked bread for five years. / Best wishes,",
            "Hello, / I am writing about the baker job. / I like bread. / Best wishes,",
            "Dear Ms Novak, / I am writing about the baker job. / I have baked bread for five years. / Best wishes,",
            "Dear Ms Novak, / I would like to apply for the baker job. / Kind regards,",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    static void Step(CoverLetter letter, string said, string expected)
    {
        var actual = letter.Read();
        Expect.That(actual == expected, "wrongLetter", new { step = said, expected, actual });
    }

    [Check("restore-brings-back-the-saved-letter")]
    static void RestoreBringsBackTheSavedLetter()
    {
        var letter = new CoverLetter();
        letter.AddParagraph("I sell flowers.");
        var first = Save(letter);
        letter.SetGreeting("Dear Mr Berg,");
        letter.AddParagraph("I know every rose.");
        var second = Save(letter);
        letter.SetClosing("Yours,");
        letter.RewriteParagraph(0, "I grow flowers.");

        Restore(letter, second);
        Step(letter, "saving two versions, editing more and restoring the second one",
            "Dear Mr Berg, / I sell flowers. / I know every rose. / Kind regards,");
        Restore(letter, first);
        Step(letter, "then restoring the first one", "Dear hiring team, / I sell flowers. / Kind regards,");
        Restore(letter, second);
        Step(letter, "then restoring the second one again",
            "Dear Mr Berg, / I sell flowers. / I know every rose. / Kind regards,");
    }

    [Check("later-changes-do-not-reach-a-saved-version")]
    static void LaterChangesDoNotReachASavedVersion()
    {
        var letter = new CoverLetter();
        letter.AddParagraph("I can drive a van.");
        letter.AddParagraph("I start at six.");
        var saved = Save(letter);

        letter.RewriteParagraph(0, "I can drive a bus.");
        letter.RewriteParagraph(1, "I start at nine.");
        letter.AddParagraph("I own a bike.");
        Restore(letter, saved);
        Step(letter, "saving, rewriting both paragraphs, adding one and restoring",
            "Dear hiring team, / I can drive a van. / I start at six. / Kind regards,");

        letter.RewriteParagraph(0, "I can fly.");
        letter.AddParagraph("I sing.");
        Restore(letter, saved);
        Step(letter, "then editing the restored letter and restoring the same version again",
            "Dear hiring team, / I can drive a van. / I start at six. / Kind regards,");
    }

    [Check("nothing-else-can-read-a-saved-version")]
    static void NothingElseCanReadASavedVersion()
    {
        var letter = new CoverLetter();
        letter.AddParagraph("I sell flowers.");
        ExpectNothingPublicInside(Save(letter));
    }

    [Check("the-letter-keeps-its-text-to-itself")]
    static void TheLetterKeepsItsTextToItself() => ExpectKeepsItsOwn(typeof(CoverLetter));

    // ---- Save and Restore, found by name ----

    // `Save()`: public, without parameters, returning something.
    static object Save(CoverLetter letter)
    {
        var save = typeof(CoverLetter).GetMethod("Save", BindingFlags.Public | BindingFlags.Instance, Type.EmptyTypes);
        if (save is null || save.ReturnType == typeof(void)) Expect.Fail("noSave");
        var saved = save.Invoke(letter, null);
        if (saved is null) Expect.Fail("savedNull");
        return saved;
    }

    // `Restore(version)`: public, with one parameter that takes what `Save()` returned.
    static void Restore(CoverLetter letter, object saved)
    {
        var restore = typeof(CoverLetter).GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(m => m.Name == "Restore" && m.GetParameters() is [var p] && p.ParameterType.IsInstanceOfType(saved));
        if (restore is null) Expect.Fail("noRestore", new { type = saved.GetType().Name });
        restore.Invoke(letter, [saved]);
    }

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(CoverLetter).Assembly;
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
