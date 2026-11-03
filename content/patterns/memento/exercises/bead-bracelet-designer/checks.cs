using System.Reflection;
using DesignPatterns.Checks;

static class BeadBraceletChecks
{
    static void Step(Bracelet bracelet, string said, string expected)
    {
        var actual = bracelet.Show();
        Expect.That(actual == expected, "wrongBeads", new { step = said, expected, actual });
    }

    [Check("restore-brings-back-the-saved-beads")]
    static void RestoreBringsBackTheSavedBeads()
    {
        var bracelet = new Bracelet();
        bracelet.Add("red");
        bracelet.Add("blue");
        var first = bracelet.Save();
        bracelet.Add("green");
        var second = bracelet.Save();
        bracelet.Recolour(0, "gold");
        bracelet.Add("white");

        bracelet.Restore(second);
        Step(bracelet, "saving \"red blue\", then \"red blue green\", changing more and restoring the second one", "red blue green");
        bracelet.Restore(first);
        Step(bracelet, "then restoring the first one", "red blue");
        bracelet.Restore(second);
        Step(bracelet, "then restoring the second one again", "red blue green");
    }

    [Check("later-changes-do-not-reach-a-saved-bracelet")]
    static void LaterChangesDoNotReachASavedBracelet()
    {
        var bracelet = new Bracelet();
        bracelet.Add("red");
        bracelet.Add("blue");
        bracelet.Add("red");
        var saved = bracelet.Save();

        bracelet.Recolour(1, "gold");
        bracelet.Recolour(2, "pink");
        bracelet.Add("white");
        bracelet.Restore(saved);
        Step(bracelet, "saving \"red blue red\", recolouring two beads, adding one and restoring", "red blue red");

        bracelet.Recolour(0, "black");
        bracelet.Add("green");
        bracelet.Restore(saved);
        Step(bracelet, "then changing the restored bracelet and restoring the same saved bracelet again", "red blue red");
    }

    [Check("nothing-else-can-read-a-saved-bracelet")]
    static void NothingElseCanReadASavedBracelet()
    {
        var bracelet = new Bracelet();
        bracelet.Add("red");
        ExpectNothingPublicInside(bracelet.Save());
    }

    [Check("the-bracelet-keeps-its-beads-to-itself")]
    static void TheBraceletKeepsItsBeadsToItself() => ExpectKeepsItsOwn(typeof(Bracelet));

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(Bracelet).Assembly;
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
