using System.Reflection;
using System.Runtime.CompilerServices;
using DesignPatterns.Checks;

static class ModelRailwayChecks
{
    static void Step(TrackLayout layout, string said, string expected)
    {
        var actual = layout.Show();
        Expect.That(actual == expected, "wrongTrack", new { step = said, expected, actual });
    }

    [Check("restore-brings-back-the-saved-layout")]
    static void RestoreBringsBackTheSavedLayout()
    {
        var layout = new TrackLayout();
        layout.Lay("straight");
        var first = layout.Save();
        layout.Lay("curve");
        var second = layout.Save();
        layout.Lay("points");

        layout.Restore(first);
        Step(layout, "saving two layouts, laying points and restoring the first one", "straight");
        layout.Restore(second);
        Step(layout, "then restoring the second one", "straight curve");
    }

    [Check("later-changes-do-not-reach-a-saved-layout")]
    static void LaterChangesDoNotReachASavedLayout()
    {
        var layout = new TrackLayout();
        layout.Lay("straight");
        var saved = layout.Save();

        layout.Lay("bridge");
        layout.Restore(saved);
        Step(layout, "saving, laying a bridge and restoring", "straight");

        layout.Lay("tunnel");
        layout.Restore(saved);
        Step(layout, "then laying a tunnel on the restored layout and restoring the same saved layout again", "straight");
    }

    [Check("undo-goes-back-one-checkpoint-at-a-time")]
    static void UndoGoesBackOneCheckpointAtATime()
    {
        var layout = new TrackLayout();
        var history = new LayoutHistory(layout);
        layout.Lay("straight");
        history.Checkpoint();
        layout.Lay("curve");
        history.Checkpoint();
        layout.Lay("points");

        history.Undo();
        Step(layout, "two checkpoints, laying points and one undo", "straight curve");
        history.Undo();
        Step(layout, "a second undo", "straight");
    }

    [Check("nothing-else-can-read-a-saved-layout")]
    static void NothingElseCanReadASavedLayout()
    {
        ExpectNoPublicState(typeof(TrackLayout));
        var layout = new TrackLayout();
        layout.Lay("straight");
        ExpectNothingPublicInside(layout.Save());
        foreach (var field in typeof(LayoutHistory).GetFields(Declared).Where(f => HoldsTextOrLayouts(f.FieldType)))
            Expect.Fail("historyKeepsOwnCopies", new { field = field.Name, fieldType = field.FieldType.Name });
    }

    // A string, or an array or generic type holding strings or other layouts. The one TrackLayout it works on is fine.
    static bool HoldsTextOrLayouts(Type t) =>
        t == typeof(string)
        || (t.HasElementType && HeldInside(t.GetElementType()!))
        || (t.IsGenericType && t.GetGenericArguments().Any(HeldInside));

    static bool HeldInside(Type t) => t == typeof(TrackLayout) || HoldsTextOrLayouts(t);

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

    // Only TrackLayout can look inside a saved copy. Every class it is (object aside) and every interface it implements (a
    // record's own IEquatable aside) is ours, so it cannot be read as a list or dictionary. And every one of those types
    // that code outside can name has no public members, constructors aside. A private nested or internal type cannot
    // be named from outside, so it may have them.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(TrackLayout).Assembly;
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
