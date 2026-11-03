using System.Reflection;
using DesignPatterns.Checks;

static class TreadmillChecks
{
    // Reads the controls themselves and the display, so both must agree, such as "8 km/h, 6%, hill".
    static void Step(Treadmill treadmill, Action action, string said, string expected)
    {
        action();
        var actual = $"{treadmill.Speed.Kmh} km/h, {treadmill.Incline.Percent}%, {treadmill.Programs.Chosen}";
        Expect.That(actual == expected, "wrongControls", new { step = said, expected, actual });
        var shown = treadmill.Display.Text;
        Expect.That(shown == expected, "wrongDisplay", new { step = said, expected, actual = shown });
    }

    static void Times(int count, Action action)
    {
        for (var i = 0; i < count; i++) action();
    }

    [Check("controls-step-within-their-range")]
    static void ControlsStepWithinTheirRange()
    {
        var treadmill = new Treadmill();
        Step(treadmill, () => { }, "starting", "0 km/h, 0%, none");
        Step(treadmill, () => Times(3, treadmill.Speed.Up), "pressing speed up 3 times", "3 km/h, 0%, none");
        Step(treadmill, () => Times(5, treadmill.Speed.Down), "pressing speed down 5 times", "0 km/h, 0%, none");
        Step(treadmill, () => Times(23, treadmill.Speed.Up), "pressing speed up 23 times", "20 km/h, 0%, none");
        Step(treadmill, () => Times(12, treadmill.Incline.Up), "pressing incline up 12 times", "20 km/h, 10%, none");
        Step(treadmill, () => treadmill.Incline.Down(), "pressing incline down once", "20 km/h, 9%, none");
    }

    [Check("programs-set-the-incline")]
    static void ProgramsSetTheIncline()
    {
        var treadmill = new Treadmill();
        Step(treadmill, () => treadmill.Programs.Choose("hill"), "choosing hill", "8 km/h, 6%, hill");
        Step(treadmill, () => Times(2, treadmill.Speed.Up), "pressing speed up twice", "10 km/h, 6%, hill");
        Step(treadmill, () => treadmill.Incline.Up(), "pressing incline up", "10 km/h, 7%, none");
        Step(treadmill, () => treadmill.Programs.Choose("flat"), "choosing flat", "10 km/h, 0%, flat");
        Step(treadmill, () => treadmill.Programs.Choose("hill"), "choosing hill again", "8 km/h, 6%, hill");
        Step(treadmill, () => treadmill.Incline.Down(), "pressing incline down", "8 km/h, 5%, none");
    }

    [Check("the-safety-key-stops-everything")]
    static void TheSafetyKeyStopsEverything()
    {
        var treadmill = new Treadmill();
        Expect.That(treadmill.Key.IsIn, "keyOut", new { expected = true, actual = treadmill.Key.IsIn });
        treadmill.Programs.Choose("hill");
        Step(treadmill, () => treadmill.Key.Pull(), "pulling the safety key during the hill program", "0 km/h, 0%, none");
        Step(treadmill, () => { treadmill.Speed.Up(); treadmill.Incline.Up(); }, "pressing speed up and incline up with the key out", "0 km/h, 0%, none");
        Step(treadmill, () => treadmill.Programs.Choose("hill"), "choosing hill with the key out", "0 km/h, 0%, none");
        Step(treadmill, () => treadmill.Key.Insert(), "putting the key back", "0 km/h, 0%, none");
        Step(treadmill, () => treadmill.Speed.Up(), "pressing speed up with the key back in", "1 km/h, 0%, none");
    }

    [Check("the-controls-know-only-the-treadmill")]
    static void TheControlsKnowOnlyTheTreadmill() =>
        ExpectNoneHoldsAnother([typeof(SpeedControl), typeof(InclineControl), typeof(SafetyKey), typeof(ProgramButtons), typeof(Display)]);

    // ---- No part holds another ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No field of a part, or of a class it inherits from, can hold one of the parts: typed as the part, as a class or
    // interface of ours that the part is, or as an array, list or other collection of them. Fields typed object and
    // delegates do not count.
    static void ExpectNoneHoldsAnother(Type[] parts)
    {
        foreach (var part in parts)
            for (var type = part; type is not null && type != typeof(object); type = type.BaseType)
                foreach (var field in type.GetFields(AnyField))
                    foreach (var other in parts)
                        Expect.That(!Holds(field.FieldType, other), "holdsAnother",
                            new { type = part.Name, field = Shown(field), other = other.Name });
    }

    static bool Holds(Type fieldType, Type part) =>
        fieldType != typeof(object) && !typeof(Delegate).IsAssignableFrom(fieldType)
        && (part.IsAssignableFrom(fieldType)
            || fieldType.Assembly == part.Assembly && fieldType.IsAssignableFrom(part)
            || fieldType.HasElementType && Holds(fieldType.GetElementType()!, part)
            || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, part)));

    // The field's name as written: "<treadmill>P" and "<Kmh>k__BackingField" become "treadmill" and "Kmh".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
