using System.Reflection;
using System.Runtime.CompilerServices;
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

    // Only Bracelet can look inside a saved copy. Every class it is (object and ValueType aside) and every interface it implements
    // (a record's IEquatable of a type of ours aside) is ours, so it cannot be read as a list or dictionary. And every one of those types
    // that code outside can name has no public members, constructors aside. A private nested or internal type cannot
    // be named from outside, so it may have them.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(Bracelet).Assembly;
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
