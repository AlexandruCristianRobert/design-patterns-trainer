using System.Reflection;
using DesignPatterns.Checks;

static class MicrowaveChecks
{
    // From a new microwave brought to `stage` by `reach`, each button gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<Microwave> reach, (string Button, Func<Microwave, string> Press, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var oven = new Microwave();
            reach(oven);
            var reached = oven.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Press(oven);
            Expect.That(result == row.Result, "wrongResult", new { stage, button = row.Button, expected = row.Result, actual = result });
            var next = oven.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, button = row.Button, expected = row.Next, actual = next });
        }
    }

    [Check("ready-starts-cooking")]
    static void ReadyStartsCooking() => FromStage("ready", _ => { },
    [
        ("start", o => o.Start(), "cooking", "cooking"),
        ("open door", o => o.OpenDoor(), "door open", "door open"),
    ]);

    [Check("opening-the-door-stops-cooking")]
    static void OpeningTheDoorStopsCooking() => FromStage("cooking", o => o.Start(),
    [
        ("open door", o => o.OpenDoor(), "stopped, door open", "door open"),
        ("start", o => o.Start(), "already cooking", "cooking"),
    ]);

    [Check("a-whole-meal")]
    static void AWholeMeal()
    {
        var oven = new Microwave();
        (string Button, Func<string> Press, string Result, string Next)[] steps =
        [
            ("open door", oven.OpenDoor, "door open", "door open"),
            ("start", oven.Start, "close the door first", "door open"),
            ("close door", oven.CloseDoor, "ready", "ready"),
            ("start", oven.Start, "cooking", "cooking"),
            ("open door", oven.OpenDoor, "stopped, door open", "door open"),
            ("close door", oven.CloseDoor, "ready", "ready"),
        ];
        for (var i = 0; i < steps.Length; i++)
        {
            var result = steps[i].Press();
            Expect.That(result == steps[i].Result, "wrongStep", new { step = i + 1, button = steps[i].Button, expected = steps[i].Result, actual = result });
            var next = oven.Status;
            Expect.That(next == steps[i].Next, "wrongStepNext", new { step = i + 1, button = steps[i].Button, expected = steps[i].Next, actual = next });
        }
    }

    [Check("one-class-per-state")]
    static void OneClassPerState()
    {
        ExpectNoStatusField(typeof(Microwave));
        ExpectOneClassPerStage(typeof(Microwave), 3);
    }

    // ---- The class keeps its current stage as an object ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // The fields of the class and of every class of ours it inherits from.
    static IEnumerable<FieldInfo> Fields(Type owner)
    {
        for (var type = owner; type is not null && type.Assembly == owner.Assembly; type = type.BaseType)
            foreach (var field in type.GetFields(AnyField))
                yield return field;
    }

    // No field that can change is of an enum type, string or bool, nullable included (const and readonly are let through).
    static void ExpectNoStatusField(Type owner)
    {
        foreach (var field in Fields(owner).Where(f => !f.IsLiteral && !f.IsInitOnly))
        {
            var type = Nullable.GetUnderlyingType(field.FieldType) ?? field.FieldType;
            Expect.That(!type.IsEnum && type != typeof(string) && type != typeof(bool), "statusField",
                new { type = owner.Name, field = Shown(field), fieldType = type.Name });
        }
    }

    // An instance field that can change is typed as an interface or class of ours that at least `count`
    // non-abstract classes of ours are, not counting the field's own type and the owner.
    static void ExpectOneClassPerStage(Type owner, int count)
    {
        var classes = owner.Assembly.GetTypes().Where(c => c.IsClass && !c.IsAbstract && c != owner).ToList();
        var candidates = Fields(owner)
            .Where(f => !f.IsStatic && !f.IsInitOnly && f.FieldType.Assembly == owner.Assembly && (f.FieldType.IsInterface || f.FieldType.IsClass))
            .Select(f => (Field: f, Count: classes.Count(c => c != f.FieldType && f.FieldType.IsAssignableFrom(c))))
            .Where(x => x.Count > 0)
            .OrderByDescending(x => x.Count)
            .ToList();
        if (candidates.Count == 0) Expect.Fail("noStageField", new { type = owner.Name });
        var best = candidates[0];
        Expect.That(best.Count >= count, "tooFewStages",
            new { type = owner.Name, field = Shown(best.Field), fieldType = best.Field.FieldType.Name, expected = count, actual = best.Count });
    }

    // The field's name as written: "<state>P" and "<Text>k__BackingField" become "state" and "Text".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
