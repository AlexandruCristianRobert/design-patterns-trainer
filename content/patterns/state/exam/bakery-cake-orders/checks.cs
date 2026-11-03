using System.Reflection;
using DesignPatterns.Checks;

static class CakeOrderChecks
{
    // From a new 30-euro order brought to `stage` by `reach`, each request gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<CakeOrder> reach, (string Request, Func<CakeOrder, string> Do, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var order = new CakeOrder(30);
            reach(order);
            var reached = order.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Do(order);
            Expect.That(result == row.Result, "wrongResult", new { stage, request = row.Request, expected = row.Result, actual = result });
            var next = order.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, request = row.Request, expected = row.Next, actual = next });
        }
    }

    [Check("an-order-is-paid-then-baked")]
    static void AnOrderIsPaidThenBaked()
    {
        var order = new CakeOrder(30);
        var start = $"{order.Status}, {order.Price} euros, {order.Refunded} refunded";
        Expect.That(start == "placed, 30 euros, 0 refunded", "wrongStart", new { expected = "placed, 30 euros, 0 refunded", actual = start });
        FromStage("placed", _ => { },
        [
            ("pay", o => o.Pay(), "paid 30 euros", "paid"),
            ("bake", o => o.Bake(), "pay first", "placed"),
            ("collect", o => o.Collect(), "not baked yet", "placed"),
            ("cancel", o => o.Cancel(), "cancelled, nothing to refund", "cancelled"),
        ]);
        FromStage("paid", o => o.Pay(),
        [
            ("pay", o => o.Pay(), "already paid", "paid"),
            ("bake", o => o.Bake(), "baked", "baked"),
            ("collect", o => o.Collect(), "not baked yet", "paid"),
            ("cancel", o => o.Cancel(), "cancelled, 30 euros refunded", "cancelled"),
        ]);
    }

    [Check("a-baked-cake-is-collected")]
    static void ABakedCakeIsCollected() => FromStage("baked", o => { o.Pay(); o.Bake(); },
    [
        ("pay", o => o.Pay(), "already paid", "baked"),
        ("bake", o => o.Bake(), "already baked", "baked"),
        ("collect", o => o.Collect(), "enjoy your cake", "collected"),
        ("cancel", o => o.Cancel(), "cancelled, 15 euros refunded", "cancelled"),
    ]);

    [Check("finished-orders-stay-finished")]
    static void FinishedOrdersStayFinished()
    {
        FromStage("collected", o => { o.Pay(); o.Bake(); o.Collect(); },
        [
            ("pay", o => o.Pay(), "already paid", "collected"),
            ("bake", o => o.Bake(), "already baked", "collected"),
            ("collect", o => o.Collect(), "already collected", "collected"),
            ("cancel", o => o.Cancel(), "already collected", "collected"),
        ]);
        FromStage("cancelled", o => { o.Pay(); o.Cancel(); },
        [
            ("pay", o => o.Pay(), "cancelled", "cancelled"),
            ("bake", o => o.Bake(), "cancelled", "cancelled"),
            ("collect", o => o.Collect(), "cancelled", "cancelled"),
            ("cancel", o => o.Cancel(), "cancelled", "cancelled"),
        ]);
    }

    [Check("the-refund-depends-on-the-stage")]
    static void TheRefundDependsOnTheStage()
    {
        (string Said, Action<CakeOrder> Reach, int Expected)[] cases =
        [
            ("cancelling a placed 25-euro order", _ => { }, 0),
            ("cancelling a paid 25-euro order", o => o.Pay(), 25),
            ("cancelling a baked 25-euro order", o => { o.Pay(); o.Bake(); }, 12),
            ("cancelling a collected 25-euro order", o => { o.Pay(); o.Bake(); o.Collect(); }, 0),
            ("cancelling a paid 25-euro order twice", o => { o.Pay(); o.Cancel(); }, 25),
        ];
        foreach (var (said, reach, expected) in cases)
        {
            var order = new CakeOrder(25);
            reach(order);
            order.Cancel();
            var actual = order.Refunded;
            Expect.That(actual == expected, "wrongRefund", new { step = said, expected, actual });
        }
        var other = new CakeOrder(40);
        var mine = new CakeOrder(25);
        other.Pay();
        mine.Pay();
        mine.Bake();
        var answer = mine.Cancel();
        Expect.That(answer == "cancelled, 12 euros refunded", "wrongOwnPrice",
            new { expected = "cancelled, 12 euros refunded", actual = answer });
    }

    [Check("the-order-keeps-no-status-field")]
    static void TheOrderKeepsNoStatusField() => ExpectNoStatusField(typeof(CakeOrder));

    [Check("one-class-per-stage")]
    static void OneClassPerStage() => ExpectOneClassPerStage(typeof(CakeOrder), 5);

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

    // The field's name as written: "<stage>P" and "<Refunded>k__BackingField" become "stage" and "Refunded".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
