using System.Reflection;
using DesignPatterns.Checks;

static class BlockOfFlatsLiftChecks
{
    // From a new lift brought to `stage` by `reach`, each action gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<Lift> reach, (string Action, Func<Lift, string> Do, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var lift = new Lift();
            reach(lift);
            var reached = lift.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Do(lift);
            Expect.That(result == row.Result, "wrongResult", new { stage, action = row.Action, expected = row.Result, actual = result });
            var next = lift.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, action = row.Action, expected = row.Next, actual = next });
        }
    }

    [Check("an-idle-lift-goes-or-opens")]
    static void AnIdleLiftGoesOrOpens()
    {
        var lift = new Lift();
        var start = $"{lift.Status} at {lift.Floor}";
        Expect.That(start == "idle at 0", "wrongStart", new { expected = "idle at 0", actual = start });
        FromStage("idle", _ => { },
        [
            ("call 4", l => l.Call(4), "going to 4", "moving"),
            ("call 0", l => l.Call(0), "doors opening", "doors open"),
            ("arrive", l => l.Arrive(), "not moving", "idle"),
            ("open", l => l.Open(), "doors opening", "doors open"),
            ("close", l => l.Close(), "doors already closed", "idle"),
        ]);
    }

    [Check("a-moving-lift-finishes-its-trip")]
    static void AMovingLiftFinishesItsTrip()
    {
        FromStage("moving", l => l.Call(2),
        [
            ("call 5", l => l.Call(5), "busy, going to 2", "moving"),
            ("arrive", l => l.Arrive(), "arrived at 2", "doors open"),
            ("open", l => l.Open(), "not between floors", "moving"),
            ("close", l => l.Close(), "doors already closed", "moving"),
        ]);
        var lift = new Lift();
        lift.Call(3);
        lift.Call(1);
        var before = lift.Floor;
        Expect.That(before == 0, "wrongFloor", new { step = "calling to 3 and 1, before arriving", expected = 0, actual = before });
        lift.Arrive();
        var after = lift.Floor;
        Expect.That(after == 3, "wrongFloor", new { step = "then arriving", expected = 3, actual = after });
    }

    [Check("open-doors-must-close-first")]
    static void OpenDoorsMustCloseFirst()
    {
        FromStage("doors open", l => { l.Call(5); l.Arrive(); },
        [
            ("call 5", l => l.Call(5), "doors already open", "doors open"),
            ("call 1", l => l.Call(1), "close the doors first", "doors open"),
            ("arrive", l => l.Arrive(), "not moving", "doors open"),
            ("open", l => l.Open(), "doors already open", "doors open"),
            ("close", l => l.Close(), "doors closed", "idle"),
        ]);
    }

    [Check("there-are-only-floors-0-to-5")]
    static void ThereAreOnlyFloors0To5()
    {
        FromStage("idle", _ => { }, [("call 6", l => l.Call(6), "no floor 6", "idle"), ("call -1", l => l.Call(-1), "no floor -1", "idle")]);
        FromStage("moving", l => l.Call(1), [("call 9", l => l.Call(9), "no floor 9", "moving")]);
        FromStage("doors open", l => l.Open(), [("call 6", l => l.Call(6), "no floor 6", "doors open")]);
    }

    [Check("a-day-in-the-lift")]
    static void ADayInTheLift()
    {
        var lift = new Lift();
        (string Action, Func<string> Do, string Result)[] steps =
        [
            ("call 3", () => lift.Call(3), "going to 3"), ("arrive", lift.Arrive, "arrived at 3"), ("close", lift.Close, "doors closed"),
            ("call 3", () => lift.Call(3), "doors opening"), ("close", lift.Close, "doors closed"), ("call 1", () => lift.Call(1), "going to 1"),
            ("arrive", lift.Arrive, "arrived at 1"), ("call 0", () => lift.Call(0), "close the doors first"),
        ];
        for (var i = 0; i < steps.Length; i++)
        {
            var result = steps[i].Do();
            Expect.That(result == steps[i].Result, "wrongStep", new { step = i + 1, action = steps[i].Action, expected = steps[i].Result, actual = result });
        }
        var floor = lift.Floor;
        Expect.That(floor == 1, "wrongFloor", new { step = "the whole day", expected = 1, actual = floor });
    }

    [Check("the-lift-keeps-no-status-field")]
    static void TheLiftKeepsNoStatusField() => ExpectNoStatusField(typeof(Lift));

    [Check("one-class-per-state")]
    static void OneClassPerState() => ExpectOneClassPerStage(typeof(Lift), 3);

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

    // No field that can change (neither const nor readonly) is of an enum type, string or bool, nullable included.
    static void ExpectNoStatusField(Type owner)
    {
        foreach (var field in Fields(owner).Where(f => !f.IsLiteral && !f.IsInitOnly))
        {
            var type = Nullable.GetUnderlyingType(field.FieldType) ?? field.FieldType;
            Expect.That(!type.IsEnum && type != typeof(string) && type != typeof(bool), "statusField",
                new { type = owner.Name, field = Shown(field), fieldType = type.Name });
        }
    }

    // An instance field that is not readonly is typed as an interface or class of ours that at least `count`
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

    // The field's name as written: "<state>P" and "<Floor>k__BackingField" become "state" and "Floor".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
