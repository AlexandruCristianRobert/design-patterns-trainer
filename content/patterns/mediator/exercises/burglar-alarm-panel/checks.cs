using System.Reflection;
using DesignPatterns.Checks;

static class BurglarAlarmChecks
{
    // Everything the panel shows at once, such as "armed, keypad shows armed, siren off, light off".
    static string Now(AlarmPanel alarm) =>
        $"{(alarm.IsArmed ? "armed" : "not armed")}, keypad shows {alarm.Keypad.Display}, " +
        $"siren {(alarm.Siren.IsSounding ? "on" : "off")}, light {(alarm.Light.IsOn ? "on" : "off")}";

    static void Step(AlarmPanel alarm, Action action, string said, string expected)
    {
        action();
        var actual = Now(alarm);
        Expect.That(actual == expected, "wrongAlarm", new { step = said, expected, actual });
    }

    [Check("the-keypad-arms-and-disarms")]
    static void TheKeypadArmsAndDisarms()
    {
        var alarm = new AlarmPanel("2580");
        var start = Now(alarm);
        Expect.That(start == "not armed, keypad shows off, siren off, light off", "wrongStart",
            new { expected = "not armed, keypad shows off, siren off, light off", actual = start });

        Step(alarm, () => alarm.FrontDoor.Open(), "opening the front door", "not armed, keypad shows off, siren off, light on");
        Step(alarm, () => alarm.Keypad.Enter("2580"), "entering the right code with the door open", "not armed, keypad shows close the door, siren off, light on");
        Step(alarm, () => alarm.FrontDoor.Close(), "closing the door", "not armed, keypad shows close the door, siren off, light on");
        Step(alarm, () => alarm.Keypad.Enter("2580"), "entering the right code with the door closed", "armed, keypad shows armed, siren off, light off");
        Step(alarm, () => alarm.Keypad.Enter("2580"), "entering the right code again", "not armed, keypad shows off, siren off, light off");
    }

    [Check("three-wrong-codes-sound-the-siren")]
    static void ThreeWrongCodesSoundTheSiren()
    {
        var alarm = new AlarmPanel("1234");
        Step(alarm, () => alarm.Keypad.Enter("1111"), "one wrong code", "not armed, keypad shows wrong code, siren off, light off");
        Step(alarm, () => alarm.Keypad.Enter("2222"), "a second wrong code", "not armed, keypad shows wrong code, siren off, light off");
        Step(alarm, () => alarm.Keypad.Enter("1234"), "the right code after two wrong ones", "armed, keypad shows armed, siren off, light off");
        Step(alarm, () => alarm.Keypad.Enter("0000"), "a wrong code after the right one", "armed, keypad shows wrong code, siren off, light off");
        Step(alarm, () => alarm.Keypad.Enter("0000"), "a second wrong code in a row", "armed, keypad shows wrong code, siren off, light off");
        Step(alarm, () => alarm.Keypad.Enter("0000"), "a third wrong code in a row", "armed, keypad shows wrong code, siren on, light off");

        var unarmed = new AlarmPanel("1234");
        foreach (var _ in new[] { 1, 2 }) unarmed.Keypad.Enter("9999");
        Step(unarmed, () => unarmed.Keypad.Enter("9999"), "three wrong codes while not armed", "not armed, keypad shows wrong code, siren on, light off");
        Step(unarmed, () => unarmed.Keypad.Enter("1234"), "the right code while the siren sounds and the panel is not armed", "not armed, keypad shows off, siren off, light off");
    }

    [Check("sensors-sound-the-siren-only-when-armed")]
    static void SensorsSoundTheSirenOnlyWhenArmed()
    {
        var alarm = new AlarmPanel("2580");
        Step(alarm, () => alarm.Hallway.Detect(), "movement in the hallway while not armed", "not armed, keypad shows off, siren off, light on");

        alarm = new AlarmPanel("2580");
        alarm.Keypad.Enter("2580");
        Step(alarm, () => alarm.FrontDoor.Open(), "opening the front door while armed", "armed, keypad shows armed, siren on, light on");

        alarm = new AlarmPanel("2580");
        alarm.Keypad.Enter("2580");
        Step(alarm, () => alarm.Hallway.Detect(), "movement in the hallway while armed", "armed, keypad shows armed, siren on, light off");
        Step(alarm, () => alarm.Keypad.Enter("2580"), "the right code while the siren sounds", "not armed, keypad shows off, siren off, light off");
    }

    [Check("the-parts-know-only-the-panel")]
    static void ThePartsKnowOnlyThePanel() =>
        ExpectNoneHoldsAnother([typeof(Keypad), typeof(DoorSensor), typeof(MotionSensor), typeof(Siren), typeof(HallLight)]);

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

    // The field's name as written: "<alarm>P" and "<Display>k__BackingField" become "alarm" and "Display".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
