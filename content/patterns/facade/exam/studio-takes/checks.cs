using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class StudioChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly Type[] Devices = [typeof(Doors), typeof(RedLight), typeof(Mixer), typeof(Recorder)];

    // A new SessionControl with an empty log. SessionControl is either created with the four devices (in any order)
    // or has a public constructor without parameters and creates them itself; both are accepted.
    static SessionControl NewControl()
    {
        StudioLog.Lines.Clear();
        foreach (var constructor in typeof(SessionControl).GetConstructors())
        {
            var types = constructor.GetParameters().Select(p => p.ParameterType).ToArray();
            if (types.Length == Devices.Length && Devices.All(types.Contains))
                return (SessionControl)constructor.Invoke(types.Select(t => t.GetConstructor(Type.EmptyTypes)!.Invoke(null)).ToArray());
        }
        var plain = typeof(SessionControl).GetConstructor(Type.EmptyTypes);
        if (plain is not null) return (SessionControl)plain.Invoke(null);
        Expect.Fail("noControlConstructor");
        return null!;
    }

    static string Log() => StudioLog.Lines.Count == 0 ? "nothing" : string.Join(" / ", StudioLog.Lines);

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    // The first of the given types that `owner`'s constructors, fields or code name, or null.
    static string? Names(Type owner, Type[] types)
    {
        var parameter = owner.GetConstructors().SelectMany(c => c.GetParameters()).Select(p => p.ParameterType).FirstOrDefault(types.Contains);
        if (parameter is not null) return parameter.Name;
        var field = owner.GetFields(Declared).SelectMany(f => Inside(f.FieldType)).FirstOrDefault(types.Contains);
        if (field is not null) return field.Name;
        var names = types.Select(t => t.Name).ToHashSet();
        return Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(d => d.Identifier.ValueText == owner.Name)
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => names.Contains(n.Identifier.ValueText))?.Identifier.ValueText;
    }

    [Check("record-gets-the-room-ready-first")]
    static void RecordGetsTheRoomReadyFirst()
    {
        NewControl().Record("Blue Hour", 8);
        var log = Log();

        Expect.That(log == "doors locked / red light on / mixer armed, 8 tracks / recording Blue Hour", "wrongRecord", new { actual = log });
    }

    [Check("stop-goes-in-reverse")]
    static void StopGoesInReverse()
    {
        var control = NewControl();
        control.Record("Night Bus", 4);
        StudioLog.Lines.Clear();
        control.Stop();
        var log = Log();

        Expect.That(log == "recording stopped / red light off / doors unlocked", "wrongStop", new { actual = log });
    }

    [Check("repeated-calls-do-nothing")]
    static void RepeatedCallsDoNothing()
    {
        var control = NewControl();
        control.Stop();
        var idle = Log();
        Expect.That(idle == "nothing", "stopWhileIdle", new { actual = idle });

        control.Record("Low Tide", 6);
        StudioLog.Lines.Clear();
        control.Record("Other Song", 2);
        var again = Log();
        Expect.That(again == "nothing", "recordWhileRecording", new { actual = again });

        control.Stop();
        StudioLog.Lines.Clear();
        control.Stop();
        var twice = Log();
        Expect.That(twice == "nothing", "stopTwice", new { actual = twice });

        control.Record("Second Take", 3);
        var next = Log();
        Expect.That(next == "doors locked / red light on / mixer armed, 3 tracks / recording Second Take", "noSecondTake", new { actual = next });
    }

    [Check("engineer-takes-through-the-control")]
    static void EngineerTakesThroughTheControl()
    {
        new Engineer(NewControl()).Take("Paper Moon", 12);
        var log = Log();

        Expect.That(log == "doors locked / red light on / mixer armed, 12 tracks / recording Paper Moon / recording stopped / red light off / doors unlocked",
            "wrongTake", new { actual = log });
    }

    [Check("devices-and-engineer-stay-apart")]
    static void DevicesAndEngineerStayApart()
    {
        var device = Names(typeof(Engineer), Devices);
        Expect.That(device is null, "engineerNamesDevice", new { type = device });

        foreach (var type in Devices)
        {
            var named = Names(type, [typeof(SessionControl), typeof(Engineer)]);
            Expect.That(named is null, "deviceKnowsCaller", new { device = type.Name, type = named });
            var other = Names(type, Devices.Where(d => d != type).ToArray());
            Expect.That(other is null, "deviceKnowsDevice", new { device = type.Name, type = other });
        }
    }
}
