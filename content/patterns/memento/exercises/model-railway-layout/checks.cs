using System.Reflection;
using DesignPatterns.Checks;

static class ModelRailwayChecks
{
    static void Step(TrackLayout layout, string said, string expected)
    {
        var actual = layout.Show();
        Expect.That(actual == expected, "wrongTrack", new { step = said, expected, actual });
    }

    [Check("the-layout-lays-lifts-and-swaps")]
    static void TheLayoutLaysLiftsAndSwaps()
    {
        var layout = new TrackLayout();
        Step(layout, "making a new layout", "(no track)");
        layout.Lay("straight");
        layout.Lay("curve");
        layout.Lay("points");
        Step(layout, "laying straight, curve and points", "straight curve points");
        layout.Swap(1, "bridge");
        Step(layout, "then swapping position 1 for a bridge", "straight bridge points");
        layout.Lift();
        Step(layout, "then lifting once", "straight bridge");
        layout.Lift();
        layout.Lift();
        layout.Lift();
        Step(layout, "then lifting three more times", "(no track)");
    }

    [Check("restore-brings-back-the-saved-layout")]
    static void RestoreBringsBackTheSavedLayout()
    {
        var layout = new TrackLayout();
        layout.Lay("straight");
        var first = layout.Save();
        layout.Lay("curve");
        var second = layout.Save();
        layout.Swap(0, "tunnel");
        layout.Lay("buffer");

        layout.Restore(second);
        Step(layout, "saving two layouts, changing more and restoring the second one", "straight curve");
        layout.Restore(first);
        Step(layout, "then restoring the first one", "straight");
        layout.Restore(second);
        Step(layout, "then restoring the second one again", "straight curve");
    }

    [Check("later-changes-do-not-reach-a-saved-layout")]
    static void LaterChangesDoNotReachASavedLayout()
    {
        var layout = new TrackLayout();
        layout.Lay("straight");
        layout.Lay("curve");
        var saved = layout.Save();

        layout.Swap(0, "bridge");
        layout.Swap(1, "points");
        layout.Lay("buffer");
        layout.Restore(saved);
        Step(layout, "saving, swapping both pieces, laying one and restoring", "straight curve");

        layout.Swap(1, "tunnel");
        layout.Lay("crossing");
        layout.Restore(saved);
        Step(layout, "then changing the restored layout and restoring the same saved layout again", "straight curve");
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
        layout.Swap(0, "bridge");

        history.Undo();
        Step(layout, "two checkpoints, more changes and one undo", "straight curve");
        history.Undo();
        Step(layout, "a second undo", "straight");
        history.Undo();
        Step(layout, "a third undo, with no checkpoint left", "straight");
    }

    [Check("redo-goes-forward-again")]
    static void RedoGoesForwardAgain()
    {
        var layout = new TrackLayout();
        var history = new LayoutHistory(layout);
        layout.Lay("straight");
        history.Checkpoint();
        layout.Lay("curve");
        history.Checkpoint();
        layout.Lay("points");
        history.Undo();
        history.Undo();

        history.Redo();
        Step(layout, "two checkpoints, laying points, two undos and one redo", "straight curve");
        history.Redo();
        Step(layout, "a second redo", "straight curve points");
        history.Redo();
        Step(layout, "a third redo, with nothing left to redo", "straight curve points");
        history.Undo();
        Step(layout, "then an undo", "straight curve");
    }

    [Check("a-new-checkpoint-clears-redo")]
    static void ANewCheckpointClearsRedo()
    {
        var layout = new TrackLayout();
        var history = new LayoutHistory(layout);
        layout.Lay("straight");
        history.Checkpoint();
        layout.Lay("curve");
        history.Undo();
        layout.Lay("tunnel");
        history.Checkpoint();
        layout.Lay("buffer");

        history.Redo();
        Step(layout, "a checkpoint, an undo, a new checkpoint at \"straight tunnel\", laying a buffer and a redo", "straight tunnel buffer");
        history.Undo();
        Step(layout, "then an undo", "straight tunnel");
        history.Undo();
        Step(layout, "then a second undo, with no checkpoint left to undo", "straight tunnel");
    }

    [Check("nothing-else-can-read-a-saved-layout")]
    static void NothingElseCanReadASavedLayout()
    {
        var layout = new TrackLayout();
        layout.Lay("straight");
        ExpectNothingPublicInside(layout.Save());
    }

    [Check("the-layout-keeps-its-pieces-to-itself")]
    static void TheLayoutKeepsItsPiecesToItself() => ExpectKeepsItsOwn(typeof(TrackLayout));

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(TrackLayout).Assembly;
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
