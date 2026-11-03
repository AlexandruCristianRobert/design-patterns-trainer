using System.Reflection;
using DesignPatterns.Checks;

static class LaundretteChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "start: 0 of 2 coins paid [idle, coins 0]",
            "coin: 1 of 2 coins paid [idle, coins 1]",
            "coin: paid, press start [paid, coins 2]",
            "coin: already paid, coin returned [paid, coins 2]",
            "start: washing [washing, coins 0]",
            "open door: locked while washing [washing, coins 0]",
            "finish: done, open the door [done, coins 0]",
            "coin: take your washing out first, coin returned [done, coins 0]",
            "open door: door open [idle, coins 0]",
            "coin: 1 of 2 coins paid [idle, coins 1]",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    // From a new washer brought to `stage` by `reach`, each button gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<Washer> reach, (string Button, Func<Washer, string> Press, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var washer = new Washer();
            reach(washer);
            var reached = washer.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Press(washer);
            Expect.That(result == row.Result, "wrongResult", new { stage, button = row.Button, expected = row.Result, actual = result });
            var next = washer.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, button = row.Button, expected = row.Next, actual = next });
        }
    }

    [Check("paying-counts-the-coins")]
    static void PayingCountsTheCoins()
    {
        FromStage("idle", _ => { },
        [
            ("coin", w => w.InsertCoin(), "1 of 2 coins paid", "idle"),
            ("start", w => w.Start(), "0 of 2 coins paid", "idle"),
            ("finish", w => w.Finish(), "not washing", "idle"),
            ("open door", w => w.OpenDoor(), "door open", "idle"),
        ]);
        FromStage("idle", w => w.InsertCoin(),
        [
            ("start", w => w.Start(), "1 of 2 coins paid", "idle"),
            ("coin", w => w.InsertCoin(), "paid, press start", "paid"),
        ]);
        FromStage("paid", w => { w.InsertCoin(); w.InsertCoin(); },
        [
            ("coin", w => w.InsertCoin(), "already paid, coin returned", "paid"),
            ("start", w => w.Start(), "washing", "washing"),
            ("finish", w => w.Finish(), "not washing", "paid"),
            ("open door", w => w.OpenDoor(), "door open", "paid"),
        ]);
    }

    [Check("washing-locks-the-door-until-done")]
    static void WashingLocksTheDoorUntilDone()
    {
        static void Washing(Washer w) { w.InsertCoin(); w.InsertCoin(); w.Start(); }
        FromStage("washing", Washing,
        [
            ("coin", w => w.InsertCoin(), "busy, coin returned", "washing"),
            ("start", w => w.Start(), "already washing", "washing"),
            ("finish", w => w.Finish(), "done, open the door", "done"),
            ("open door", w => w.OpenDoor(), "locked while washing", "washing"),
        ]);
        FromStage("done", w => { Washing(w); w.Finish(); },
        [
            ("coin", w => w.InsertCoin(), "take your washing out first, coin returned", "done"),
            ("start", w => w.Start(), "take your washing out first", "done"),
            ("finish", w => w.Finish(), "not washing", "done"),
            ("open door", w => w.OpenDoor(), "door open", "idle"),
        ]);
    }

    [Check("each-wash-costs-two-coins")]
    static void EachWashCostsTwoCoins()
    {
        var washer = new Washer();
        for (var wash = 1; wash <= 2; wash++)
        {
            washer.InsertCoin();
            washer.InsertCoin();
            var paid = washer.Coins;
            Expect.That(paid == 2, "wrongCoins", new { wash, moment = "after two coins", expected = 2, actual = paid });
            washer.Start();
            var left = washer.Coins;
            Expect.That(left == 0, "wrongCoins", new { wash, moment = "after start", expected = 0, actual = left });
            washer.Finish();
            washer.OpenDoor();
            var status = washer.Status;
            Expect.That(status == "idle", "notIdleAgain", new { wash, expected = "idle", actual = status });
        }
    }

    [Check("the-washer-keeps-no-status-field")]
    static void TheWasherKeepsNoStatusField() => ExpectNoStatusField(typeof(Washer));

    [Check("one-class-per-state")]
    static void OneClassPerState() => ExpectOneClassPerStage(typeof(Washer), 4);

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

    // The field's name as written: "<state>P" and "<Coins>k__BackingField" become "state" and "Coins".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
