using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SeatingPlanChecks
{
    // Where Ana, Ben and Cleo sit, such as "Ana 1, Ben 2, Cleo 0". 0 means not seated.
    static string Tables(SeatingPlan plan) =>
        string.Join(", ", new[] { "Ana", "Ben", "Cleo" }.Select(g => $"{g} {plan.TableOf(g)}"));

    [Check("each-change-does-and-undoes-itself")]
    static void EachChangeDoesAndUndoesItself()
    {
        var plan = new SeatingPlan();
        plan.Place("Ana", 1);
        plan.Place("Ben", 2);
        const string start = "Ana 1, Ben 2, Cleo 0";

        void Try(PlanChange change, string name, string afterDo)
        {
            change.Do();
            var done = Tables(plan);
            Expect.That(done == afterDo, "wrongDo", new { change = name, expected = afterDo, actual = done });
            change.Undo();
            var undone = Tables(plan);
            Expect.That(undone == start, "wrongUndo", new { change = name, expected = start, actual = undone });
        }

        Try(new SeatGuest(plan, "Cleo", 3), "SeatGuest(plan, \"Cleo\", 3)", "Ana 1, Ben 2, Cleo 3");
        Try(new MoveGuest(plan, "Ben", 4), "MoveGuest(plan, \"Ben\", 4)", "Ana 1, Ben 4, Cleo 0");
    }

    [Check("undo-goes-back-one-change-at-a-time")]
    static void UndoGoesBackOneChangeAtATime()
    {
        var plan = new SeatingPlan();
        var log = new ChangeLog();
        log.Run(new SeatGuest(plan, "Ana", 1));
        log.Run(new SeatGuest(plan, "Ben", 2));
        log.Run(new MoveGuest(plan, "Ana", 3));
        log.Run(new MoveGuest(plan, "Ben", 1));
        var all = Tables(plan);
        Expect.That(all == "Ana 3, Ben 1, Cleo 0", "wrongRun", new { expected = "Ana 3, Ben 1, Cleo 0", actual = all });

        string[] expected = ["Ana 3, Ben 2, Cleo 0", "Ana 1, Ben 2, Cleo 0", "Ana 1, Ben 0, Cleo 0", "Ana 0, Ben 0, Cleo 0"];
        for (var i = 0; i < expected.Length; i++)
        {
            log.Undo();
            var now = Tables(plan);
            Expect.That(now == expected[i], "wrongUndo", new { undos = i + 1, expected = expected[i], actual = now });
        }
    }

    [Check("the-log-knows-only-plan-changes")]
    static void TheLogKnowsOnlyPlanChanges()
    {
        var change = typeof(PlanChange);
        foreach (var type in new[] { typeof(SeatGuest), typeof(MoveGuest) })
            Expect.That(change.IsAssignableFrom(type), "notAChange", new { type = type.Name });

        foreach (var field in typeof(ChangeLog).GetFields(BindingFlags.Instance | BindingFlags.Static
                     | BindingFlags.Public | BindingFlags.NonPublic))
            foreach (var concrete in new[] { typeof(SeatGuest), typeof(MoveGuest), typeof(SeatingPlan) })
                Expect.That(!Involves(field.FieldType, concrete), "logHoldsConcrete", new { field = field.Name, type = concrete.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "ChangeLog")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "SeatGuest" or "MoveGuest" or "SeatingPlan");
        Expect.That(named is null, "logNamesConcrete", new { type = named?.Identifier.ValueText });
    }

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));
}
