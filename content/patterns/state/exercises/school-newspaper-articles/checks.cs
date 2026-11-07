using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SchoolNewspaperChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "approve: submit it first [draft]",
            "submit: sent to the editor [with the editor]",
            "reject: sent back to the writer [draft]",
            "submit: sent to the editor [with the editor]",
            "approve: in the next issue [going to print]",
            "reject: already going to print [going to print]",
            "submit: already going to print [going to print]",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    // From a new article brought to `stage` by `reach`, each action gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<Article> reach, (string Action, Func<Article, string> Do, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var article = new Article();
            reach(article);
            var reached = article.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Do(article);
            Expect.That(result == row.Result, "wrongResult", new { stage, action = row.Action, expected = row.Result, actual = result });
            var next = article.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, action = row.Action, expected = row.Next, actual = next });
        }
    }

    [Check("drafts-go-to-the-editor-and-back")]
    static void DraftsGoToTheEditorAndBack()
    {
        FromStage("draft", _ => { },
        [
            ("submit", a => a.Submit(), "sent to the editor", "with the editor"),
            ("approve", a => a.Approve(), "submit it first", "draft"),
            ("reject", a => a.Reject(), "submit it first", "draft"),
        ]);
        FromStage("with the editor", a => a.Submit(),
        [
            ("submit", a => a.Submit(), "already with the editor", "with the editor"),
            ("approve", a => a.Approve(), "in the next issue", "going to print"),
            ("reject", a => a.Reject(), "sent back to the writer", "draft"),
        ]);
    }

    [Check("printed-articles-stay-put")]
    static void PrintedArticlesStayPut() => FromStage("going to print", a => { a.Submit(); a.Approve(); },
    [
        ("submit", a => a.Submit(), "already going to print", "going to print"),
        ("approve", a => a.Approve(), "already going to print", "going to print"),
        ("reject", a => a.Reject(), "already going to print", "going to print"),
    ]);

    [Check("one-class-per-state")]
    static void OneClassPerState()
    {
        ExpectContextDecidesNothing(typeof(Article));
        ExpectNoStatusField(typeof(Article));
        ExpectOneClassPerStage(typeof(Article), 3);
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
