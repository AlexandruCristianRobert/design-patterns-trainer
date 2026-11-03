using System.Reflection;
using DesignPatterns.Checks;

static class SchoolNewspaperChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "approve: submit it first [draft]",
            "submit: sent to the editor [with the editor]",
            "reject: sent back to the writer (1 of 3) [draft]",
            "submit: sent to the editor [with the editor]",
            "withdraw: back to draft [draft]",
            "submit: sent to the editor [with the editor]",
            "approve: in the next issue [going to print]",
            "reject: already going to print [going to print]",
            "withdraw: too late, it is going to print [going to print]",
            "submit: sent to the editor [with the editor]",
            "reject: sent back to the writer (1 of 3) [draft]",
            "submit: sent to the editor [with the editor]",
            "reject: sent back to the writer (2 of 3) [draft]",
            "submit: sent to the editor [with the editor]",
            "reject: dropped after 3 rejections [dropped]",
            "submit: dropped, write a new article [dropped]",
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
            ("withdraw", a => a.Withdraw(), "already a draft", "draft"),
        ]);
        FromStage("with the editor", a => a.Submit(),
        [
            ("submit", a => a.Submit(), "already with the editor", "with the editor"),
            ("approve", a => a.Approve(), "in the next issue", "going to print"),
            ("reject", a => a.Reject(), "sent back to the writer (1 of 3)", "draft"),
            ("withdraw", a => a.Withdraw(), "back to draft", "draft"),
        ]);
    }

    [Check("printed-and-dropped-articles-stay-put")]
    static void PrintedAndDroppedArticlesStayPut()
    {
        FromStage("going to print", a => { a.Submit(); a.Approve(); },
        [
            ("submit", a => a.Submit(), "already going to print", "going to print"),
            ("approve", a => a.Approve(), "already going to print", "going to print"),
            ("reject", a => a.Reject(), "already going to print", "going to print"),
            ("withdraw", a => a.Withdraw(), "too late, it is going to print", "going to print"),
        ]);
        static void Drop(Article a) { for (var i = 0; i < 3; i++) { a.Submit(); a.Reject(); } }
        FromStage("dropped", Drop,
        [
            ("submit", a => a.Submit(), "dropped, write a new article", "dropped"),
            ("approve", a => a.Approve(), "dropped, write a new article", "dropped"),
            ("reject", a => a.Reject(), "dropped, write a new article", "dropped"),
            ("withdraw", a => a.Withdraw(), "dropped, write a new article", "dropped"),
        ]);
    }

    [Check("each-article-counts-its-own-rejections")]
    static void EachArticleCountsItsOwnRejections()
    {
        var first = new Article();
        var second = new Article();
        first.Submit();
        first.Reject();
        second.Submit();
        second.Withdraw();
        second.Submit();
        var answer = second.Reject();
        Expect.That(answer == "sent back to the writer (1 of 3)", "wrongCount",
            new { step = "rejecting the first article once, then withdrawing and rejecting the second", expected = "sent back to the writer (1 of 3)", actual = answer });
        Expect.That(first.Rejections == 1 && second.Rejections == 1, "wrongRejections",
            new { expected = "1 and 1", actual = $"{first.Rejections} and {second.Rejections}" });
        first.Submit();
        answer = first.Reject();
        Expect.That(answer == "sent back to the writer (2 of 3)", "wrongCount",
            new { step = "then rejecting the first article again", expected = "sent back to the writer (2 of 3)", actual = answer });
    }

    [Check("the-article-keeps-no-status-field")]
    static void TheArticleKeepsNoStatusField() => ExpectNoStatusField(typeof(Article));

    [Check("one-class-per-state")]
    static void OneClassPerState() => ExpectOneClassPerStage(typeof(Article), 4);

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

    // The field's name as written: "<state>P" and "<Rejections>k__BackingField" become "state" and "Rejections".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
