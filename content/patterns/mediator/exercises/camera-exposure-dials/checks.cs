using System.Reflection;
using DesignPatterns.Checks;

static class CameraDialChecks
{
    // Turns one dial and compares what the viewfinder shows, which holds all three settings.
    static void Step(Camera camera, Action turn, string said, string expected)
    {
        turn();
        var actual = camera.Viewfinder.Text;
        Expect.That(actual == expected, "wrongSettings", new { step = said, expected, actual });
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["manual f/8 1/250", "manual f/4 1/250", "auto f/4 1/500", "auto f/16 1/125", "auto f/2 1/1000", "manual f/2 1/500"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("manual-dials-turn-alone")]
    static void ManualDialsTurnAlone()
    {
        var camera = new Camera();
        Expect.That(camera.Viewfinder.Text == "manual f/8 1/250", "wrongStart", new { expected = "manual f/8 1/250", actual = camera.Viewfinder.Text });
        Step(camera, () => camera.Aperture.Turn(1), "in manual, turning the aperture 1 click", "manual f/16 1/250");
        Step(camera, () => camera.Aperture.Turn(3), "in manual, turning the aperture 3 more clicks past f/16", "manual f/16 1/250");
        Step(camera, () => camera.Aperture.Turn(-9), "in manual, turning the aperture back 9 clicks", "manual f/2 1/250");
        Step(camera, () => camera.Shutter.Turn(-4), "in manual, turning the shutter back 4 clicks", "manual f/2 1/60");
        Step(camera, () => camera.Shutter.Turn(7), "in manual, turning the shutter 7 clicks", "manual f/2 1/1000");
    }

    [Check("auto-matches-the-shutter-to-the-aperture")]
    static void AutoMatchesTheShutterToTheAperture()
    {
        var camera = new Camera();
        Step(camera, () => camera.Aperture.Turn(-2), "in manual, turning the aperture back 2 clicks", "manual f/2 1/250");
        Step(camera, () => camera.Mode.Turn("auto"), "switching to auto at f/2", "auto f/2 1/1000");
        Step(camera, () => camera.Aperture.Turn(1), "in auto, turning the aperture 1 click", "auto f/4 1/500");
        Step(camera, () => camera.Aperture.Turn(2), "in auto, turning the aperture 2 more clicks", "auto f/16 1/125");
        Step(camera, () => camera.Mode.Turn("manual"), "switching back to manual", "manual f/16 1/125");
        Step(camera, () => camera.Aperture.Turn(-1), "in manual again, turning the aperture back 1 click", "manual f/8 1/125");
    }

    [Check("auto-matches-the-aperture-to-the-shutter")]
    static void AutoMatchesTheApertureToTheShutter()
    {
        var camera = new Camera();
        Step(camera, () => camera.Mode.Turn("auto"), "switching to auto at f/8", "auto f/8 1/250");
        Step(camera, () => camera.Shutter.Turn(-2), "in auto, turning the shutter back 2 clicks", "auto f/16 1/60");
        Step(camera, () => camera.Shutter.Turn(1), "in auto, turning the shutter 1 click", "auto f/16 1/125");
        Step(camera, () => camera.Shutter.Turn(2), "in auto, turning the shutter 2 more clicks", "auto f/4 1/500");
        Step(camera, () => camera.Shutter.Turn(5), "in auto, turning the shutter 5 more clicks", "auto f/2 1/1000");
    }

    [Check("the-dials-know-only-the-camera")]
    static void TheDialsKnowOnlyTheCamera() =>
        ExpectNoneHoldsAnother([typeof(ModeDial), typeof(ApertureRing), typeof(ShutterDial), typeof(Viewfinder)]);

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

    // The field's name as written: "<camera>P" and "<Text>k__BackingField" become "screen" and "Text".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
