using System.Reflection;
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
        var ours = typeof(TrackLayout).Assembly;
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
