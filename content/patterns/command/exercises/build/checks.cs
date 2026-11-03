using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SeatingPlanChecks
{
    // Where Ana, Ben, Cleo and Dev sit, such as "Ana 1, Ben 2, Cleo 0, Dev 0". 0 means not seated.
    static string Tables(SeatingPlan plan) =>
        string.Join(", ", new[] { "Ana", "Ben", "Cleo", "Dev" }.Select(g => $"{g} {plan.TableOf(g)}"));

    // Ana at table 1, Ben and Cleo at table 2, Dev not seated.
    static SeatingPlan Seated()
    {
        var plan = new SeatingPlan();
        plan.Place("Ana", 1);
        plan.Place("Ben", 2);
        plan.Place("Cleo", 2);
        return plan;
    }

    const string Start = "Ana 1, Ben 2, Cleo 2, Dev 0";

    static void Try(SeatingPlan plan, PlanChange change, string name, string afterDo)
    {
        change.Do();
        var done = Tables(plan);
        Expect.That(done == afterDo, "wrongDo", new { change = name, expected = afterDo, actual = done });
        change.Undo();
        var undone = Tables(plan);
        Expect.That(undone == Start, "wrongUndo", new { change = name, expected = Start, actual = undone });
    }

    [Check("each-change-does-and-undoes-itself")]
    static void EachChangeDoesAndUndoesItself()
    {
        var plan = Seated();
        Try(plan, new SeatGuest(plan, "Dev", 3), "SeatGuest(plan, \"Dev\", 3)", "Ana 1, Ben 2, Cleo 2, Dev 3");
        Try(plan, new MoveGuest(plan, "Cleo", 1), "MoveGuest(plan, \"Cleo\", 1)", "Ana 1, Ben 2, Cleo 1, Dev 0");
        Try(plan, new MoveGuest(plan, "Ana", 4), "MoveGuest(plan, \"Ana\", 4)", "Ana 4, Ben 2, Cleo 2, Dev 0");
        Try(plan, new SwapGuests(plan, "Ana", "Cleo"), "SwapGuests(plan, \"Ana\", \"Cleo\")", "Ana 2, Ben 2, Cleo 1, Dev 0");
        Try(plan, new SwapGuests(plan, "Ben", "Cleo"), "SwapGuests(plan, \"Ben\", \"Cleo\")", "Ana 1, Ben 2, Cleo 2, Dev 0");
    }

    [Check("undo-goes-back-one-change-at-a-time")]
    static void UndoGoesBackOneChangeAtATime()
    {
        var plan = new SeatingPlan();
        var log = new ChangeLog();
        log.Run(new SeatGuest(plan, "Ana", 1));
        log.Run(new SeatGuest(plan, "Ben", 2));
        log.Run(new MoveGuest(plan, "Ana", 3));
        log.Run(new SwapGuests(plan, "Ana", "Ben"));
        log.Run(new MoveGuest(plan, "Ben", 5));

        string[] expected =
        [
            "Ana 2, Ben 3, Cleo 0, Dev 0",
            "Ana 3, Ben 2, Cleo 0, Dev 0",
            "Ana 1, Ben 2, Cleo 0, Dev 0",
            "Ana 1, Ben 0, Cleo 0, Dev 0",
            "Ana 0, Ben 0, Cleo 0, Dev 0",
            "Ana 0, Ben 0, Cleo 0, Dev 0",
        ];
        for (var i = 0; i < expected.Length; i++)
        {
            log.Undo();
            var now = Tables(plan);
            Expect.That(now == expected[i], "wrongUndo", new { undos = i + 1, expected = expected[i], actual = now });
        }
    }

    [Check("redo-does-the-undone-changes-again")]
    static void RedoDoesTheUndoneChangesAgain()
    {
        var plan = new SeatingPlan();
        var log = new ChangeLog();
        log.Run(new SeatGuest(plan, "Ana", 1));
        log.Run(new SeatGuest(plan, "Ben", 2));
        log.Run(new MoveGuest(plan, "Ana", 2));
        log.Undo();
        log.Undo();

        string[] expected = ["Ana 1, Ben 2, Cleo 0, Dev 0", "Ana 2, Ben 2, Cleo 0, Dev 0", "Ana 2, Ben 2, Cleo 0, Dev 0"];
        for (var i = 0; i < expected.Length; i++)
        {
            log.Redo();
            var now = Tables(plan);
            Expect.That(now == expected[i], "wrongRedo", new { redos = i + 1, expected = expected[i], actual = now });
        }

        log.Undo();
        log.Undo();
        var back = Tables(plan);
        Expect.That(back == "Ana 1, Ben 0, Cleo 0, Dev 0", "wrongUndoAfterRedo",
            new { expected = "Ana 1, Ben 0, Cleo 0, Dev 0", actual = back });
    }

    [Check("a-new-change-clears-redo")]
    static void ANewChangeClearsRedo()
    {
        var plan = new SeatingPlan();
        var log = new ChangeLog();
        log.Run(new SeatGuest(plan, "Ana", 1));
        log.Run(new SeatGuest(plan, "Ben", 2));
        log.Undo();
        log.Run(new SeatGuest(plan, "Cleo", 4));
        log.Redo();
        var now = Tables(plan);
        Expect.That(now == "Ana 1, Ben 0, Cleo 4, Dev 0", "redoAfterNewChange",
            new { expected = "Ana 1, Ben 0, Cleo 4, Dev 0", actual = now });
    }

    [Check("the-log-knows-only-plan-changes")]
    static void TheLogKnowsOnlyPlanChanges()
    {
        var change = typeof(PlanChange);
        foreach (var type in new[] { typeof(SeatGuest), typeof(MoveGuest), typeof(SwapGuests) })
            Expect.That(change.IsAssignableFrom(type), "notAChange", new { type = type.Name });

        foreach (var field in typeof(ChangeLog).GetFields(AnyField))
            foreach (var concrete in new[] { typeof(SeatGuest), typeof(MoveGuest), typeof(SwapGuests), typeof(SeatingPlan) })
                Expect.That(!Involves(field.FieldType, concrete), "logHoldsConcrete", new { field = field.Name, type = concrete.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "ChangeLog")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "SeatGuest" or "MoveGuest" or "SwapGuests" or "SeatingPlan");
        Expect.That(named is null, "logNamesConcrete", new { type = named?.Identifier.ValueText });
    }

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));
}
