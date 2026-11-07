using System.Reflection;
using DesignPatterns.Checks;

static class BurglarAlarmChecks
{
    [Check("opening-the-door-while-armed-sounds-the-siren")]
    static void OpeningTheDoorWhileArmedSoundsTheSiren()
    {
        var alarm = new AlarmPanel();
        Expect.That(!alarm.Keypad.IsArmed && !alarm.Siren.IsSounding, "wrongStart",
            new { expected = "not armed, siren off", actual = $"armed {alarm.Keypad.IsArmed}, siren {alarm.Siren.IsSounding}" });

        alarm.FrontDoor.Open();
        Expect.That(!alarm.Siren.IsSounding, "wrongSiren", new { after = "opening the door while not armed", expected = false, actual = alarm.Siren.IsSounding });

        alarm.Keypad.Arm();
        Expect.That(alarm.Keypad.IsArmed, "notArmed", new { expected = true, actual = alarm.Keypad.IsArmed });
        Expect.That(!alarm.Siren.IsSounding, "wrongSiren", new { after = "arming", expected = false, actual = alarm.Siren.IsSounding });

        alarm.FrontDoor.Open();
        Expect.That(alarm.Siren.IsSounding, "wrongSiren", new { after = "opening the door while armed", expected = true, actual = alarm.Siren.IsSounding });
    }

    [Check("disarming-stops-the-siren")]
    static void DisarmingStopsTheSiren()
    {
        var alarm = new AlarmPanel();
        alarm.Keypad.Arm();
        alarm.FrontDoor.Open();

        alarm.Keypad.Disarm();
        Expect.That(!alarm.Keypad.IsArmed, "stillArmed", new { expected = false, actual = alarm.Keypad.IsArmed });
        Expect.That(!alarm.Siren.IsSounding, "wrongSiren", new { after = "disarming while the siren sounded", expected = false, actual = alarm.Siren.IsSounding });

        alarm.FrontDoor.Open();
        Expect.That(!alarm.Siren.IsSounding, "wrongSiren", new { after = "opening the door again after disarming", expected = false, actual = alarm.Siren.IsSounding });
    }

    [Check("the-parts-know-only-the-panel")]
    static void ThePartsKnowOnlyThePanel()
    {
        Type[] parts = [typeof(Keypad), typeof(DoorSensor), typeof(Siren)];
        foreach (var part in parts)
            foreach (var field in part.GetFields(AnyField))
                foreach (var other in parts)
                    Expect.That(!Holds(field.FieldType, other), "holdsAnother", new { type = part.Name, field = Shown(field), other = other.Name });
    }

    const BindingFlags AnyField = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A field holds a part when it is typed as that part, or as an array or collection of them.
    static bool Holds(Type fieldType, Type part) =>
        part.IsAssignableFrom(fieldType)
        || fieldType.HasElementType && Holds(fieldType.GetElementType()!, part)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, part));

    // The field's name as written: "<alarm>P" and "<IsArmed>k__BackingField" become "alarm" and "IsArmed".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
