using System.Reflection;
using DesignPatterns.Checks;

static class PhoneBatteryChecks
{
    // Changes the phone, then compares the battery, the mode, the sync and the camera with `expected`.
    static void Step(Phone phone, Action change, string said, string expected)
    {
        change();
        var actual = $"{phone.Battery}%, {phone.Mode}, sync {phone.Sync()}, {phone.Camera()}";
        Expect.That(actual == expected, "wrongPhone", new { step = said, expected, actual });
    }

    [Check("normal-runs-down-into-saver")]
    static void NormalRunsDownIntoSaver()
    {
        var phone = new Phone();
        Step(phone, () => { }, "making a new phone", "100%, normal, sync every 15 minutes, camera on");
        Step(phone, () => phone.Drain(79), "draining 79", "21%, normal, sync every 15 minutes, camera on");
        Step(phone, () => phone.Drain(1), "then draining 1", "20%, saver, sync every hour, camera on, flash off");
        Step(phone, () => phone.Drain(10), "then draining 10", "10%, saver, sync every hour, camera on, flash off");
    }

    [Check("saving-ends-only-at-50")]
    static void SavingEndsOnlyAt50()
    {
        var phone = new Phone();
        phone.Drain(85);
        Step(phone, () => phone.Charge(15), "draining to 15 and charging 15", "30%, saver, sync every hour, camera on, flash off");
        Step(phone, () => phone.Charge(19), "then charging 19", "49%, saver, sync every hour, camera on, flash off");
        Step(phone, () => phone.Charge(1), "then charging 1", "50%, normal, sync every 15 minutes, camera on");
        Step(phone, () => phone.Drain(25), "then draining 25", "25%, normal, sync every 15 minutes, camera on");
        Step(phone, () => phone.Charge(10), "then charging 10", "35%, normal, sync every 15 minutes, camera on");
    }

    [Check("critical-and-back")]
    static void CriticalAndBack()
    {
        var phone = new Phone();
        Step(phone, () => phone.Drain(96), "draining 96 at once", "4%, critical, sync off, battery too low");
        Step(phone, () => phone.Charge(1), "then charging 1", "5%, critical, sync off, battery too low");
        Step(phone, () => phone.Charge(5), "then charging 5", "10%, saver, sync every hour, camera on, flash off");
        Step(phone, () => phone.Drain(5), "then draining 5", "5%, critical, sync off, battery too low");
        Step(phone, () => phone.Charge(60), "then charging 60", "65%, normal, sync every 15 minutes, camera on");
        Step(phone, () => phone.Drain(55), "then draining 55", "10%, saver, sync every hour, camera on, flash off");
    }

    [Check("the-battery-stays-between-0-and-100")]
    static void TheBatteryStaysBetween0And100()
    {
        var phone = new Phone();
        Step(phone, () => phone.Charge(30), "charging a full phone 30", "100%, normal, sync every 15 minutes, camera on");
        Step(phone, () => phone.Drain(150), "then draining 150", "0%, critical, sync off, battery too low");
        Step(phone, () => phone.Drain(5), "then draining 5", "0%, critical, sync off, battery too low");
        Step(phone, () => phone.Charge(120), "then charging 120", "100%, normal, sync every 15 minutes, camera on");
    }

    [Check("the-phone-keeps-no-mode-field")]
    static void ThePhoneKeepsNoModeField() => ExpectNoStatusField(typeof(Phone));

    [Check("one-class-per-mode")]
    static void OneClassPerMode() => ExpectOneClassPerStage(typeof(Phone), 3);

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

    // The field's name as written: "<mode>P" and "<Battery>k__BackingField" become "mode" and "Battery".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
