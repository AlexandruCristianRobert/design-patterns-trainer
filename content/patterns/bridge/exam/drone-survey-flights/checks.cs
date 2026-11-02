using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class DroneChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // True when `type` or one of its base classes keeps an instance field of type `held`.
    static bool Keeps(Type type, Type held)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            if (t.GetFields(Declared).Any(f => f.FieldType == held)) return true;
        return false;
    }

    // No class that is `top` or derives from it names one of the program's classes that implement or derive from `held`.
    static void NamesNoDroneClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesDrone", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    [Check("each-drone-flies-its-own-way")]
    static void EachDroneFliesItsOwnWay()
    {
        var quad = $"{new Quadcopter().Fly(50)} / {new Quadcopter().Turn(90)}";
        var wing = $"{new FixedWing().Fly(50)} / {new FixedWing().Turn(90)}";

        Expect.That(quad == "quad fly 50 m / quad turn 90", "wrongQuad", new { actual = quad });
        Expect.That(wing == "wing glide 50 m / wing bank 90", "wrongWing", new { actual = wing });
    }

    [Check("out-and-back-on-both-drones")]
    static void OutAndBackOnBothDrones()
    {
        var quad = string.Join(" | ", new OutAndBack(new Quadcopter(), 300).Plan());
        var wing = string.Join(" | ", new OutAndBack(new FixedWing(), 300).Plan());

        Expect.That(quad == "quad fly 300 m | quad turn 180 | quad fly 300 m", "wrongOutAndBack", new { drone = "quadcopter", actual = quad, expected = "quad fly 300 m | quad turn 180 | quad fly 300 m" });
        Expect.That(wing == "wing glide 300 m | wing bank 180 | wing glide 300 m", "wrongOutAndBack", new { drone = "fixed wing", actual = wing, expected = "wing glide 300 m | wing bank 180 | wing glide 300 m" });
    }

    [Check("grid-sweep-on-both-drones")]
    static void GridSweepOnBothDrones()
    {
        (string Drone, int Rows, string Actual, string Expected)[] cases =
        [
            ("fixed wing", 2, string.Join(" | ", new GridSweep(new FixedWing(), 2, 500).Plan()),
                "wing glide 500 m | wing bank 90 | wing glide 10 m | wing bank 90 | wing glide 500 m"),
            ("quadcopter", 1, string.Join(" | ", new GridSweep(new Quadcopter(), 1, 80).Plan()),
                "quad fly 80 m"),
            ("quadcopter", 3, string.Join(" | ", new GridSweep(new Quadcopter(), 3, 80).Plan()),
                "quad fly 80 m | quad turn 90 | quad fly 10 m | quad turn 90 | quad fly 80 m | quad turn 90 | quad fly 10 m | quad turn 90 | quad fly 80 m"),
        ];
        foreach (var (drone, rows, actual, expected) in cases)
            Expect.That(actual == expected, "wrongGridSweep", new { drone, rows, actual, expected });
    }

    [Check("flights-hold-a-drone")]
    static void FlightsHoldADrone()
    {
        var drone = typeof(Drone);
        Expect.That(drone.IsInterface || drone.IsAbstract, "droneNotAbstract");
        foreach (var flight in new[] { typeof(OutAndBack), typeof(GridSweep) })
        {
            Expect.That(typeof(Flight).IsAssignableFrom(flight), "notAFlight", new { type = flight.Name });
            Expect.That(Keeps(flight, drone), "holdsNoDrone", new { type = flight.Name });
        }
        NamesNoDroneClass(typeof(Flight), drone);
    }
}
