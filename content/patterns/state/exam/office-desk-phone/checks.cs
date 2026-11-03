using System.Reflection;
using DesignPatterns.Checks;

static class DeskPhoneChecks
{
    // From a new phone brought to `stage` by `reach`, each button gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<DeskPhone> reach, (string Button, Func<DeskPhone, string> Press, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var phone = new DeskPhone();
            reach(phone);
            var reached = phone.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Press(phone);
            Expect.That(result == row.Result, "wrongResult", new { stage, button = row.Button, expected = row.Result, actual = result });
            var next = phone.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, button = row.Button, expected = row.Next, actual = next });
        }
    }

    [Check("an-idle-phone-rings")]
    static void AnIdlePhoneRings()
    {
        var status = new DeskPhone().Status;
        Expect.That(status == "idle", "wrongStart", new { expected = "idle", actual = status });
        FromStage("idle", _ => { },
        [
            ("ring", p => p.Ring(), "ringing", "ringing"),
            ("pick up", p => p.PickUp(), "dial tone", "idle"),
            ("hold", p => p.Hold(), "no call", "idle"),
            ("put down", p => p.PutDown(), "already down", "idle"),
        ]);
        FromStage("ringing", p => p.Ring(),
        [
            ("ring", p => p.Ring(), "already ringing", "ringing"),
            ("pick up", p => p.PickUp(), "connected", "talking"),
            ("hold", p => p.Hold(), "pick up first", "ringing"),
            ("put down", p => p.PutDown(), "call rejected", "idle"),
        ]);
    }

    [Check("a-call-goes-on-hold-and-back")]
    static void ACallGoesOnHoldAndBack()
    {
        FromStage("talking", p => { p.Ring(); p.PickUp(); },
        [
            ("ring", p => p.Ring(), "call waiting", "talking"),
            ("pick up", p => p.PickUp(), "already talking", "talking"),
            ("hold", p => p.Hold(), "on hold", "on hold"),
            ("put down", p => p.PutDown(), "call ended", "idle"),
        ]);
        FromStage("on hold", p => { p.Ring(); p.PickUp(); p.Hold(); },
        [
            ("ring", p => p.Ring(), "call waiting", "on hold"),
            ("pick up", p => p.PickUp(), "back to the call", "talking"),
            ("hold", p => p.Hold(), "back to the call", "talking"),
            ("put down", p => p.PutDown(), "call ended", "idle"),
        ]);
    }

    [Check("only-picked-up-calls-count-as-answered")]
    static void OnlyPickedUpCallsCountAsAnswered()
    {
        var phone = new DeskPhone();
        (string Said, Action Press, int Expected)[] steps =
        [
            ("picking up an idle phone", () => phone.PickUp(), 0),
            ("then a call that is rejected", () => { phone.Ring(); phone.PutDown(); }, 0),
            ("then a call that is answered", () => { phone.Ring(); phone.PickUp(); }, 1),
            ("then holding it, picking it up again and putting it down", () => { phone.Hold(); phone.PickUp(); phone.PutDown(); }, 1),
            ("then another answered call", () => { phone.Ring(); phone.PickUp(); phone.PutDown(); }, 2),
        ];
        foreach (var (said, press, expected) in steps)
        {
            press();
            var actual = phone.Answered;
            Expect.That(actual == expected, "wrongAnswered", new { step = said, expected, actual });
        }
    }

    [Check("the-phone-keeps-no-status-field")]
    static void ThePhoneKeepsNoStatusField() => ExpectNoStatusField(typeof(DeskPhone));

    [Check("one-class-per-stage")]
    static void OneClassPerStage() => ExpectOneClassPerStage(typeof(DeskPhone), 4);

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

    // The field's name as written: "<stage>P" and "<Answered>k__BackingField" become "stage" and "Answered".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
