using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class CarWashChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly Type[] Machines = [typeof(Gate), typeof(Sprayer), typeof(Brushes), typeof(Dryer)];

    // A new CarWash with an empty log. CarWash is either created with the four machines (in any order)
    // or has a public constructor without parameters and creates them itself; both are accepted.
    static CarWash NewCarWash()
    {
        WashLog.Lines.Clear();
        foreach (var constructor in typeof(CarWash).GetConstructors())
        {
            var types = constructor.GetParameters().Select(p => p.ParameterType).ToArray();
            if (types.Length == Machines.Length && Machines.All(types.Contains))
                return (CarWash)constructor.Invoke(types.Select(t => t.GetConstructor(Type.EmptyTypes)!.Invoke(null)).ToArray());
        }
        var plain = typeof(CarWash).GetConstructor(Type.EmptyTypes);
        if (plain is not null) return (CarWash)plain.Invoke(null);
        Expect.Fail("noCarWashConstructor");
        return null!;
    }

    static string Log() => WashLog.Lines.Count == 0 ? "nothing" : string.Join(" / ", WashLog.Lines);

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("basic-wash-runs-in-order")]
    static void BasicWashRunsInOrder()
    {
        var washed = NewCarWash().Wash("AB-123", "basic");
        var log = Log();

        Expect.That(log == "open gate for AB-123 / soak / scrub 1x / rinse / dry / close gate", "wrongBasic", new { actual = log });
        Expect.That(washed, "basicReturnedFalse");
    }

    [Check("deluxe-wash-scrubs-twice-and-waxes")]
    static void DeluxeWashScrubsTwiceAndWaxes()
    {
        var washed = NewCarWash().Wash("XY-9", "deluxe");
        var log = Log();

        Expect.That(log == "open gate for XY-9 / soak / scrub 2x / rinse / wax / dry / close gate", "wrongDeluxe", new { actual = log });
        Expect.That(washed, "deluxeReturnedFalse");
    }

    [Check("unknown-programme-runs-nothing")]
    static void UnknownProgrammeRunsNothing()
    {
        var washed = NewCarWash().Wash("CD-45", "polish");
        var log = Log();

        Expect.That(log == "nothing", "unknownRanMachines", new { actual = log });
        Expect.That(!washed, "unknownReturnedTrue");
    }

    [Check("pay-station-knows-only-the-car-wash")]
    static void PayStationKnowsOnlyTheCarWash()
    {
        var reply = new PayStation(NewCarWash()).Pay("EF-6", "basic");
        var log = Log();
        Expect.That(log == "open gate for EF-6 / soak / scrub 1x / rinse / dry / close gate" && reply == "EF-6: thank you, drive in",
            "wrongPayment", new { reply, actual = log });

        var station = typeof(PayStation);
        var parameter = station.GetConstructors().SelectMany(c => c.GetParameters()).FirstOrDefault(p => Machines.Contains(p.ParameterType));
        Expect.That(parameter is null, "stationTakesMachine", new { type = parameter?.ParameterType.Name });
        var field = station.GetFields(Declared).SelectMany(f => Inside(f.FieldType)).FirstOrDefault(Machines.Contains);
        Expect.That(field is null, "stationKeepsMachine", new { type = field?.Name });

        var names = Machines.Select(m => m.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "PayStation"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().FirstOrDefault(n => names.Contains(n.Identifier.ValueText));
            Expect.That(named is null, "stationNamesMachine", new { type = named?.Identifier.ValueText });
        }
    }
}
