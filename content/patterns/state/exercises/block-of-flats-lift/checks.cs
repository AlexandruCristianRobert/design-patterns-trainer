using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BlockOfFlatsLiftChecks
{
    // From a new lift brought to `stage` by `reach`, each button gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<Lift> reach, (string Button, Func<Lift, string> Press, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var lift = new Lift();
            reach(lift);
            var reached = lift.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Press(lift);
            Expect.That(result == row.Result, "wrongResult", new { stage, button = row.Button, expected = row.Result, actual = result });
            var next = lift.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, button = row.Button, expected = row.Next, actual = next });
        }
    }

    [Check("an-idle-lift-sets-off-when-called")]
    static void AnIdleLiftSetsOffWhenCalled() => FromStage("idle", _ => { },
    [
        ("call", l => l.Call(), "on its way", "moving"),
        ("arrive", l => l.Arrive(), "not moving", "idle"),
        ("close doors", l => l.CloseDoors(), "doors already closed", "idle"),
    ]);

    [Check("a-moving-lift-opens-its-doors-on-arrival")]
    static void AMovingLiftOpensItsDoorsOnArrival() => FromStage("moving", l => l.Call(),
    [
        ("call", l => l.Call(), "busy", "moving"),
        ("arrive", l => l.Arrive(), "doors opening", "doors open"),
        ("close doors", l => l.CloseDoors(), "doors already closed", "moving"),
    ]);

    [Check("open-doors-must-close-first")]
    static void OpenDoorsMustCloseFirst() => FromStage("doors open", l => { l.Call(); l.Arrive(); },
    [
        ("call", l => l.Call(), "close the doors first", "doors open"),
        ("arrive", l => l.Arrive(), "not moving", "doors open"),
        ("close doors", l => l.CloseDoors(), "doors closed", "idle"),
    ]);

    [Check("one-class-per-state")]
    static void OneClassPerState()
    {
        ExpectContextDecidesNothing(typeof(Lift));
        ExpectNoStatusField(typeof(Lift));
        ExpectOneClassPerStage(typeof(Lift), 3);
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

    // The class decides nothing itself: no switch, if, ?: or `is` anywhere in it.
    static void ExpectContextDecidesNothing(Type owner)
    {
        var found = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(d => d.Identifier.ValueText == owner.Name)
            .SelectMany(d => d.DescendantNodes())
            .Select(Decision)
            .FirstOrDefault(word => word is not null);
        Expect.That(found is null, "contextDecides", new { type = owner.Name, found });
    }

    static string? Decision(Microsoft.CodeAnalysis.SyntaxNode node) => node switch
    {
        SwitchStatementSyntax or SwitchExpressionSyntax => "switch",
        IfStatementSyntax => "if",
        ConditionalExpressionSyntax => "?:",
        IsPatternExpressionSyntax => "is",
        BinaryExpressionSyntax b when b.OperatorToken.ValueText == "is" => "is",
        _ => null,
    };

    // The field's name as written: "<state>P" and "<Status>k__BackingField" become "state" and "Status".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
