using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using DesignPatterns.Checks;

static class CameraDialChecks
{
    // All three settings at once, such as "auto f/8 1/250".
    static string Settings(Camera camera) => $"{camera.Mode.Setting} f/{camera.Aperture.FNumber} 1/{camera.Shutter.Speed}";

    // Turns one dial and compares the settings afterwards.
    static void Step(Camera camera, Action turn, string said, string expected)
    {
        turn();
        var actual = Settings(camera);
        Expect.That(actual == expected, "wrongSettings", new { step = said, expected, actual });
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["manual f/8 1/250", "manual f/4 1/250", "auto f/4 1/500", "auto f/16 1/125", "auto f/16 1/1000", "manual f/2 1/1000"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("in-manual-each-dial-moves-alone")]
    static void InManualEachDialMovesAlone()
    {
        var camera = new Camera();
        var start = Settings(camera);
        Expect.That(start == "manual f/8 1/250", "wrongStart", new { expected = "manual f/8 1/250", actual = start });
        Step(camera, () => camera.Aperture.Turn(2), "in manual, turning the aperture to f/2", "manual f/2 1/250");
        Step(camera, () => camera.Shutter.Turn(60), "in manual, turning the shutter to 1/60", "manual f/2 1/60");
    }

    [Check("in-auto-the-shutter-follows-the-aperture")]
    static void InAutoTheShutterFollowsTheAperture()
    {
        var camera = new Camera();
        Step(camera, () => camera.Aperture.Turn(16), "in manual, turning the aperture to f/16", "manual f/16 1/250");
        Step(camera, () => camera.Mode.Turn("auto"), "switching to auto at f/16", "auto f/16 1/125");
        Step(camera, () => camera.Aperture.Turn(2), "in auto, turning the aperture to f/2", "auto f/2 1/1000");
        Step(camera, () => camera.Aperture.Turn(8), "in auto, turning the aperture to f/8", "auto f/8 1/250");
        Step(camera, () => camera.Shutter.Turn(60), "in auto, turning the shutter to 1/60", "auto f/8 1/60");
        Step(camera, () => camera.Mode.Turn("manual"), "switching back to manual", "manual f/8 1/60");
    }

    [Check("the-dials-know-only-the-camera")]
    static void TheDialsKnowOnlyTheCamera()
    {
        Type[] dials = [typeof(ModeDial), typeof(ApertureRing), typeof(ShutterDial)];
        foreach (var dial in dials)
            foreach (var field in dial.GetFields(AnyField))
                foreach (var other in dials)
                    Expect.That(!Holds(field.FieldType, other), "holdsAnother", new { type = dial.Name, field = Shown(field), other = other.Name });

        // No part reads a member of the camera that holds a part, such as `camera.Shutter`.
        var held = HeldBy(typeof(Camera), dials);
        foreach (var (type, member) in MembersRead(dials))
            Expect.That(!held.Contains(member), "reachesThrough", new { type, member });
    }

    const BindingFlags AnyField = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // The names of the hub's fields and properties that hold a part.
    static HashSet<string> HeldBy(Type hub, Type[] parts) =>
        hub.GetProperties(AnyField).Where(p => parts.Any(part => Holds(p.PropertyType, part))).Select(p => p.Name)
            .Concat(hub.GetFields(AnyField).Where(f => !f.Name.StartsWith('<') && parts.Any(part => Holds(f.FieldType, part))).Select(f => f.Name))
            .ToHashSet();

    // Every member a part reads with `x.Member` or `x?.Member`, inside the part's own class.
    static IEnumerable<(string Type, string Member)> MembersRead(Type[] parts) =>
        from declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
        where parts.Any(p => p.Name == declaration.Identifier.ValueText)
        from name in declaration.DescendantNodes().OfType<SimpleNameSyntax>()
        where name.Parent is MemberAccessExpressionSyntax m && m.Name == name || name.Parent is MemberBindingExpressionSyntax
        select (declaration.Identifier.ValueText, name.Identifier.ValueText);

    // A field holds a dial when it is typed as that dial, or as an array or collection of them. Delegates do not count.
    static bool Holds(Type fieldType, Type dial) =>
        !typeof(Delegate).IsAssignableFrom(fieldType)
        && (dial.IsAssignableFrom(fieldType)
            || fieldType.HasElementType && Holds(fieldType.GetElementType()!, dial)
            || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, dial)));

    // The field's name as written: "<camera>P" and "<Setting>k__BackingField" become "camera" and "Setting".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
