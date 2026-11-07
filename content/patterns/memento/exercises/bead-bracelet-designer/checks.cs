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
        var first = bracelet.Save();
        bracelet.Add("blue");
        var second = bracelet.Save();
        bracelet.Add("gold");

        bracelet.Restore(first);
        Step(bracelet, "saving \"red\", then \"red blue\", adding gold and restoring the first one", "red");
        bracelet.Restore(second);
        Step(bracelet, "then restoring the second one", "red blue");
    }

    [Check("later-changes-do-not-reach-a-saved-bracelet")]
    static void LaterChangesDoNotReachASavedBracelet()
    {
        var bracelet = new Bracelet();
        bracelet.Add("red");
        var saved = bracelet.Save();

        bracelet.Add("gold");
        bracelet.Restore(saved);
        Step(bracelet, "saving \"red\", adding gold and restoring", "red");

        bracelet.Add("pink");
        bracelet.Restore(saved);
        Step(bracelet, "then adding pink to the restored bracelet and restoring the same saved bracelet again", "red");
    }

    [Check("nothing-else-can-read-a-saved-bracelet")]
    static void NothingElseCanReadASavedBracelet()
    {
        ExpectNoPublicState(typeof(Bracelet));
        var bracelet = new Bracelet();
        bracelet.Add("red");
        ExpectNothingPublicInside(bracelet.Save());
    }

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // The class (and any class of ours it inherits from) has no public field and no public set or init.
    static void ExpectNoPublicState(Type owner)
    {
        for (var t = owner; t is not null && t.Assembly == owner.Assembly; t = t.BaseType)
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicField", new { type = owner.Name, field = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.SetMethod?.IsPublic == true))
                Expect.Fail("publicSetter", new { type = owner.Name, property = property.Name });
        }
    }

    // No type the saved copy is (its class, a base class or an interface of ours) that code outside can name has a
    // public field or property. A private nested or internal type cannot be named from outside, so it may.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(Bracelet).Assembly;
        var type = saved.GetType();
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
}
