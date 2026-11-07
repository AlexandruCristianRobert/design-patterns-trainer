using System.Reflection;
using System.Runtime.CompilerServices;
using DesignPatterns.Checks;

static class CoverLetterChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Dear Ms Novak, / I would like to apply for the baker job.",
            "Dear Ms Novak, / I would like to apply for the baker job. / I have baked bread for five years.",
            "Hello, / I would like to apply for the baker job. / I have baked bread for five years. / I like bread.",
            "Dear Ms Novak, / I would like to apply for the baker job. / I have baked bread for five years.",
            "Dear Ms Novak, / I would like to apply for the baker job.",
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
        var second = Save(letter);
        letter.AddParagraph("I know every rose.");

        Restore(letter, first);
        Step(letter, "saving two versions, editing more and restoring the first one", "Dear hiring team, / I sell flowers.");
        Restore(letter, second);
        Step(letter, "then restoring the second one", "Dear Mr Berg, / I sell flowers.");
    }

    [Check("later-changes-do-not-reach-a-saved-version")]
    static void LaterChangesDoNotReachASavedVersion()
    {
        var letter = new CoverLetter();
        letter.AddParagraph("I can drive a van.");
        var saved = Save(letter);

        letter.AddParagraph("I own a bike.");
        Restore(letter, saved);
        Step(letter, "saving, adding a paragraph and restoring", "Dear hiring team, / I can drive a van.");

        letter.AddParagraph("I sing.");
        Restore(letter, saved);
        Step(letter, "then adding a paragraph to the restored letter and restoring the same version again",
            "Dear hiring team, / I can drive a van.");
    }

    [Check("nothing-else-can-read-a-saved-version")]
    static void NothingElseCanReadASavedVersion()
    {
        ExpectNoPublicState(typeof(CoverLetter));
        var letter = new CoverLetter();
        letter.AddParagraph("I sell flowers.");
        ExpectNothingPublicInside(Save(letter));
    }

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

    // Only CoverLetter can look inside a saved copy. Every class it is (object aside) and every interface it implements (a
    // record's own IEquatable aside) is ours, so it cannot be read as a list or dictionary. And every one of those types
    // that code outside can name has no public members, constructors aside. A private nested or internal type cannot
    // be named from outside, so it may have them.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(CoverLetter).Assembly;
        var type = saved.GetType();
        var types = new List<Type>();
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
        {
            if (t.Assembly != ours) Expect.Fail("foreignType", new { type = type.Name, other = t.Name });
            types.Add(t);
        }
        foreach (var i in type.GetInterfaces())
        {
            if (i.Assembly == ours) types.Add(i);
            else if (!(i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEquatable<>) && i.GetGenericArguments()[0] == type))
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
