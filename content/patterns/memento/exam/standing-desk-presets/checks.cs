using System.Reflection;
using DesignPatterns.Checks;

static class StandingDeskChecks
{
    static void Step(Desk desk, Action change, string said, string expected)
    {
        change();
        var actual = desk.Show();
        Expect.That(actual == expected, "wrongDesk", new { step = said, expected, actual });
    }

    [Check("the-desk-moves-within-its-limits")]
    static void TheDeskMovesWithinItsLimits()
    {
        var desk = new Desk();
        Step(desk, () => { }, "making a new desk", "desk 72 cm, monitors 0/0 cm, lamp off");
        Step(desk, () => { desk.SetHeight(100); desk.SetMonitor(1, 12); desk.SetLamp(true); }, "setting the height to 100, the right monitor to 12 and the lamp on", "desk 100 cm, monitors 0/12 cm, lamp on");
        Step(desk, () => { desk.SetHeight(200); desk.SetMonitor(0, 55); }, "then setting the height to 200 and the left monitor to 55", "desk 125 cm, monitors 40/12 cm, lamp on");
        Step(desk, () => { desk.SetHeight(10); desk.SetMonitor(1, -3); desk.SetLamp(false); }, "then setting the height to 10, the right monitor to -3 and the lamp off", "desk 65 cm, monitors 40/0 cm, lamp off");
    }

    [Check("recall-brings-back-the-stored-position")]
    static void RecallBringsBackTheStoredPosition()
    {
        var desk = new Desk();
        var buttons = new PresetButtons();
        desk.SetHeight(110);
        desk.SetMonitor(0, 20);
        desk.SetMonitor(1, 22);
        desk.SetLamp(true);
        buttons.Store(1, desk.Save());
        desk.SetHeight(75);
        desk.SetMonitor(1, 4);
        buttons.Store(2, desk.Save());
        desk.SetHeight(90);
        desk.SetLamp(false);

        Step(desk, () => desk.Restore(buttons.Recall(1)!), "storing two positions on buttons 1 and 2, moving on and recalling button 1", "desk 110 cm, monitors 20/22 cm, lamp on");
        Step(desk, () => desk.Restore(buttons.Recall(2)!), "then recalling button 2", "desk 75 cm, monitors 20/4 cm, lamp on");
        Step(desk, () => desk.Restore(buttons.Recall(1)!), "then recalling button 1 again", "desk 110 cm, monitors 20/22 cm, lamp on");
    }

    [Check("each-button-keeps-its-last-position")]
    static void EachButtonKeepsItsLastPosition()
    {
        var desk = new Desk();
        var buttons = new PresetButtons();
        for (var button = 1; button <= 4; button++)
            Expect.That(buttons.Recall(button) is null, "notEmpty", new { button });

        var first = desk.Save();
        var second = desk.Save();
        var third = desk.Save();
        buttons.Store(3, first);
        buttons.Store(4, second);
        buttons.Store(3, third);
        Expect.That(ReferenceEquals(buttons.Recall(3), third), "wrongPosition", new { button = 3, expected = "the second position stored on it" });
        Expect.That(ReferenceEquals(buttons.Recall(4), second), "wrongPosition", new { button = 4, expected = "the position stored on it" });
        Expect.That(buttons.Recall(1) is null, "notEmpty", new { button = 1 });
    }

    [Check("a-stored-position-stays-as-it-was")]
    static void AStoredPositionStaysAsItWas()
    {
        var desk = new Desk();
        desk.SetMonitor(0, 10);
        desk.SetMonitor(1, 30);
        var position = desk.Save();
        desk.SetMonitor(0, 2);
        desk.SetMonitor(1, 3);
        desk.SetHeight(120);
        Step(desk, () => desk.Restore(position), "saving with monitors 10/30, moving both monitors and the desk, and restoring", "desk 72 cm, monitors 10/30 cm, lamp off");
        desk.SetMonitor(1, 40);
        desk.SetLamp(true);
        Step(desk, () => desk.Restore(position), "then moving the restored desk and restoring the same position again", "desk 72 cm, monitors 10/30 cm, lamp off");
    }

    [Check("nothing-else-can-read-a-saved-position")]
    static void NothingElseCanReadASavedPosition() => ExpectNothingPublicInside(new Desk().Save());

    [Check("the-desk-keeps-its-settings-to-itself")]
    static void TheDeskKeepsItsSettingsToItself() => ExpectKeepsItsOwn(typeof(Desk));

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(Desk).Assembly;
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
