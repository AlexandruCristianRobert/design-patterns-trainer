using System.Reflection;
using DesignPatterns.Checks;

static class RiceCookerChecks
{
    // From a new cooker brought to `stage` by `reach`, each button gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<RiceCooker> reach, (string Button, Func<RiceCooker, string> Press, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var cooker = new RiceCooker();
            reach(cooker);
            var reached = cooker.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Press(cooker);
            Expect.That(result == row.Result, "wrongResult", new { stage, button = row.Button, expected = row.Result, actual = result });
            var next = cooker.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, button = row.Button, expected = row.Next, actual = next });
        }
    }

    // An hour passes: it answers nothing, so the row gives the status instead.
    static string Hour(RiceCooker cooker)
    {
        cooker.Hour();
        return "(no answer)";
    }

    [Check("off-and-lid-open")]
    static void OffAndLidOpen()
    {
        var status = new RiceCooker().Status;
        Expect.That(status == "off", "wrongStart", new { expected = "off", actual = status });
        FromStage("off", _ => { },
        [
            ("cook", c => c.Cook(), "cooking", "cooking"),
            ("rice done", c => c.RiceDone(), "not cooking", "off"),
            ("open lid", c => c.OpenLid(), "lid open", "lid open"),
            ("close lid", c => c.CloseLid(), "lid already closed", "off"),
            ("an hour", Hour, "(no answer)", "off"),
        ]);
        FromStage("lid open", c => c.OpenLid(),
        [
            ("cook", c => c.Cook(), "close the lid first", "lid open"),
            ("rice done", c => c.RiceDone(), "not cooking", "lid open"),
            ("open lid", c => c.OpenLid(), "lid already open", "lid open"),
            ("close lid", c => c.CloseLid(), "off", "off"),
            ("an hour", Hour, "(no answer)", "lid open"),
        ]);
    }

    [Check("cooking-locks-the-lid")]
    static void CookingLocksTheLid() => FromStage("cooking", c => c.Cook(),
    [
        ("cook", c => c.Cook(), "already cooking", "cooking"),
        ("rice done", c => c.RiceDone(), "keeping warm", "keeping warm"),
        ("open lid", c => c.OpenLid(), "lid locked while cooking", "cooking"),
        ("close lid", c => c.CloseLid(), "lid already closed", "cooking"),
        ("an hour", Hour, "(no answer)", "cooking"),
    ]);

    [Check("cooked-rice-is-kept-warm")]
    static void CookedRiceIsKeptWarm() => FromStage("keeping warm", c => { c.Cook(); c.RiceDone(); },
    [
        ("cook", c => c.Cook(), "already cooked", "keeping warm"),
        ("rice done", c => c.RiceDone(), "not cooking", "keeping warm"),
        ("open lid", c => c.OpenLid(), "lid open, enjoy", "lid open"),
        ("close lid", c => c.CloseLid(), "lid already closed", "keeping warm"),
        ("an hour", Hour, "(no answer)", "keeping warm"),
    ]);

    [Check("keeping-warm-ends-after-3-hours")]
    static void KeepingWarmEndsAfter3Hours()
    {
        var cooker = new RiceCooker();
        cooker.Hour();
        cooker.Hour();
        cooker.Cook();
        cooker.Hour();
        cooker.RiceDone();
        for (var round = 1; round <= 2; round++)
        {
            for (var hour = 1; hour <= 3; hour++)
            {
                cooker.Hour();
                var expected = hour < 3 ? "keeping warm" : "off";
                var actual = cooker.Status;
                Expect.That(actual == expected, "wrongAfterHours", new { round, hours = hour, expected, actual });
            }
            cooker.Cook();
            cooker.RiceDone();
        }
    }

    [Check("the-cooker-keeps-no-status-field")]
    static void TheCookerKeepsNoStatusField() => ExpectNoStatusField(typeof(RiceCooker));

    [Check("one-class-per-stage")]
    static void OneClassPerStage() => ExpectOneClassPerStage(typeof(RiceCooker), 4);

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

    // The field's name as written: "<stage>P" and "<Status>k__BackingField" become "stage" and "Status".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
