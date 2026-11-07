using System.Reflection;
using DesignPatterns.Checks;

static class PedestrianCrossingChecks
{
    // From a new crossing brought to `stage` by `reach`, each action gives its answer and leaves the stated stage.
    static void FromStage(string stage, Action<Crossing> reach, (string Action, Func<Crossing, string> Do, string Result, string Next)[] rows)
    {
        foreach (var row in rows)
        {
            var crossing = new Crossing();
            reach(crossing);
            var reached = crossing.Status;
            Expect.That(reached == stage, "notReached", new { stage, expected = stage, actual = reached });
            var result = row.Do(crossing);
            Expect.That(result == row.Result, "wrongResult", new { stage, action = row.Action, expected = row.Result, actual = result });
            var next = crossing.Status;
            Expect.That(next == row.Next, "wrongNext", new { stage, action = row.Action, expected = row.Next, actual = next });
        }
    }

    [Check("cars-go-until-someone-presses")]
    static void CarsGoUntilSomeonePresses() => FromStage("cars go", _ => { },
    [
        ("tick", c => c.Tick(), "cars go", "cars go"),
        ("press", c => c.Press(), "wait", "waiting"),
    ]);

    [Check("waiting-turns-to-walk")]
    static void WaitingTurnsToWalk() => FromStage("waiting", c => c.Press(),
    [
        ("press", c => c.Press(), "wait", "waiting"),
        ("tick", c => c.Tick(), "walk", "walk"),
    ]);

    [Check("the-walk-ends-and-the-cars-go-again")]
    static void TheWalkEndsAndTheCarsGoAgain() => FromStage("walk", c => { c.Press(); c.Tick(); },
    [
        ("press", c => c.Press(), "walk now", "walk"),
        ("tick", c => c.Tick(), "cars go", "cars go"),
    ]);

    [Check("one-class-per-state")]
    static void OneClassPerState()
    {
        ExpectNoStatusField(typeof(Crossing));
        ExpectOneClassPerStage(typeof(Crossing), 3);
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

    // The field's name as written: "<state>P" and "<Status>k__BackingField" become "state" and "Status".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
