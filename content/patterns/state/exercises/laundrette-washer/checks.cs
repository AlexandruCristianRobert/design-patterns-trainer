using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class LaundretteChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "start: insert a coin first [idle]",
            "coin: paid, press start [paid]",
            "coin: already paid, coin returned [paid]",
            "start: washing [washing]",
            "coin: busy, coin returned [washing]",
            "finish: done [idle]",
            "coin: paid, press start [paid]",
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

    [Check("paying-then-starting")]
    static void PayingThenStarting()
    {
        FromStage("idle", _ => { },
        [
            ("coin", w => w.InsertCoin(), "paid, press start", "paid"),
            ("start", w => w.Start(), "insert a coin first", "idle"),
            ("finish", w => w.Finish(), "not washing", "idle"),
        ]);
        FromStage("paid", w => w.InsertCoin(),
        [
            ("coin", w => w.InsertCoin(), "already paid, coin returned", "paid"),
            ("start", w => w.Start(), "washing", "washing"),
            ("finish", w => w.Finish(), "not washing", "paid"),
        ]);
    }

    [Check("washing-until-finished")]
    static void WashingUntilFinished() => FromStage("washing", w => { w.InsertCoin(); w.Start(); },
    [
        ("coin", w => w.InsertCoin(), "busy, coin returned", "washing"),
        ("start", w => w.Start(), "already washing", "washing"),
        ("finish", w => w.Finish(), "done", "idle"),
    ]);

    [Check("one-class-per-state")]
    static void OneClassPerState()
    {
        ExpectContextDecidesNothing(typeof(Washer));
        ExpectNoStatusField(typeof(Washer));
        ExpectOneClassPerStage(typeof(Washer), 3);
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
