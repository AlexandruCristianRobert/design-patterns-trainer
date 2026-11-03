using System.Reflection;
using DesignPatterns.Checks;

static class TimetableDraftChecks
{
    // Shows two days, Mon and Wed, so changes on either are seen.
    static void Step(Timetable timetable, string said, string expected)
    {
        var actual = $"Mon: {timetable.Day("Mon")} | Wed: {timetable.Day("Wed")}";
        Expect.That(actual == expected, "wrongTimetable", new { step = said, expected, actual });
    }

    [Check("the-timetable-sets-periods")]
    static void TheTimetableSetsPeriods()
    {
        var timetable = new Timetable();
        Step(timetable, "making a new timetable", "Mon: -, -, -, - | Wed: -, -, -, -");
        timetable.Set("Wed", 2, "history");
        timetable.Set("Wed", 4, "PE");
        timetable.Set("Mon", 1, "maths");
        Step(timetable, "setting history and PE on Wed, periods 2 and 4, and maths on Mon, period 1", "Mon: maths, -, -, - | Wed: -, history, -, PE");
        timetable.Set("Wed", 4, "music");
        timetable.Set("Fri", 3, "art");
        Step(timetable, "then setting music on Wed, period 4, and art on Fri", "Mon: maths, -, -, - | Wed: -, history, -, music");
        var friday = timetable.Day("Fri");
        Expect.That(friday == "-, -, art, -", "wrongDay", new { day = "Fri", expected = "-, -, art, -", actual = friday });
    }

    [Check("restore-brings-back-the-saved-draft")]
    static void RestoreBringsBackTheSavedDraft()
    {
        var timetable = new Timetable();
        timetable.Set("Mon", 1, "maths");
        var first = timetable.Save();
        timetable.Set("Wed", 3, "science");
        var second = timetable.Save();
        timetable.Set("Mon", 1, "French");
        timetable.Set("Wed", 1, "drama");

        timetable.Restore(second);
        Step(timetable, "saving two drafts, changing more and restoring the second one", "Mon: maths, -, -, - | Wed: -, -, science, -");
        timetable.Restore(first);
        Step(timetable, "then restoring the first one", "Mon: maths, -, -, - | Wed: -, -, -, -");
        timetable.Restore(second);
        Step(timetable, "then restoring the second one again", "Mon: maths, -, -, - | Wed: -, -, science, -");
    }

    [Check("later-changes-do-not-reach-a-saved-draft")]
    static void LaterChangesDoNotReachASavedDraft()
    {
        var timetable = new Timetable();
        timetable.Set("Mon", 2, "English");
        timetable.Set("Wed", 2, "maths");
        var draft = timetable.Save();

        timetable.Set("Mon", 2, "geography");
        timetable.Set("Wed", 1, "chess");
        timetable.Restore(draft);
        Step(timetable, "saving, changing a period on Mon and one on Wed, and restoring", "Mon: -, English, -, - | Wed: -, maths, -, -");

        timetable.Set("Wed", 2, "PE");
        timetable.Set("Mon", 4, "art");
        timetable.Restore(draft);
        Step(timetable, "then changing the restored timetable and restoring the same draft again", "Mon: -, English, -, - | Wed: -, maths, -, -");
    }

    [Check("the-shelf-keeps-the-last-three-labels")]
    static void TheShelfKeepsTheLastThreeLabels()
    {
        var timetable = new Timetable();
        var shelf = new DraftShelf();
        var drafts = new Dictionary<string, ITimetableDraft>();
        foreach (var label in new[] { "a", "b", "c", "d" })
        {
            drafts[label] = timetable.Save();
            shelf.Put(label, drafts[label]);
        }
        var labels = string.Join(" ", shelf.Labels);
        Expect.That(labels == "b c d", "wrongLabels", new { step = "putting drafts a, b, c and d", expected = "b c d", actual = labels });
        Expect.That(shelf.Take("a") is null, "notGone", new { label = "a" });

        var again = timetable.Save();
        shelf.Put("b", again);
        labels = string.Join(" ", shelf.Labels);
        Expect.That(labels == "c d b", "wrongLabels", new { step = "then putting a new draft labelled b", expected = "c d b", actual = labels });
        Expect.That(ReferenceEquals(shelf.Take("b"), again), "wrongDraft", new { label = "b", expected = "the new draft labelled b" });
        Expect.That(ReferenceEquals(shelf.Take("c"), drafts["c"]) && ReferenceEquals(shelf.Take("c"), drafts["c"]), "wrongDraft", new { label = "c", expected = "the draft labelled c, every time it is asked" });
        labels = string.Join(" ", shelf.Labels);
        Expect.That(labels == "c d b", "wrongLabels", new { step = "then taking b once and c twice", expected = "c d b", actual = labels });
    }

    [Check("nothing-else-can-read-a-saved-draft")]
    static void NothingElseCanReadASavedDraft() => ExpectNothingPublicInside(new Timetable().Save());

    [Check("the-timetable-keeps-its-periods-to-itself")]
    static void TheTimetableKeepsItsPeriodsToItself() => ExpectKeepsItsOwn(typeof(Timetable));

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(Timetable).Assembly;
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
