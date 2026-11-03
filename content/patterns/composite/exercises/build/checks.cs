using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PowerStripChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Three levels: house holds Heater and office; office holds Lamp and desk; desk holds Laptop, Monitor and Speaker.
    static (PowerStrip House, PowerStrip Desk) ThreeLevels()
    {
        var desk = new PowerStrip(500);
        desk.Add(new Appliance("Laptop", 65));
        desk.Add(new Appliance("Monitor", 30));
        desk.Add(new Appliance("Speaker", 20));
        var office = new PowerStrip(1000);
        office.Add(new Appliance("Lamp", 40));
        office.Add(desk);
        var house = new PowerStrip(3000);
        house.Add(new Appliance("Heater", 1500));
        house.Add(office);
        return (house, desk);
    }

    static string Show(List<string> devices) => devices.Count == 0 ? "nothing" : string.Join(", ", devices);

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("appliance-answers-for-itself")]
    static void ApplianceAnswersForItself()
    {
        IPlug kettle = new Appliance("Kettle", 2200);

        Expect.That(kettle.Watts() == 2200, "wrongWatts", new { actual = kettle.Watts() });
        Expect.That(Show(kettle.Devices()) == "Kettle", "wrongDevices", new { expected = "Kettle", actual = Show(kettle.Devices()) });
    }

    [Check("strip-adds-up-watts")]
    static void StripAddsUpWatts()
    {
        var (house, desk) = ThreeLevels();
        var before = ((IPlug)house).Watts();
        desk.Add(new Appliance("Charger", 10));
        var after = ((IPlug)house).Watts();

        Expect.That(before == 1655, "wrongWatts", new { actual = before });
        Expect.That(after == 1665, "missedLateDevice", new { actual = after });
    }

    [Check("strip-lists-devices-in-order")]
    static void StripListsDevicesInOrder()
    {
        var (house, _) = ThreeLevels();
        var devices = Show(((IPlug)house).Devices());

        Expect.That(devices == "Heater, Lamp, Laptop, Monitor, Speaker", "wrongDevices", new { expected = "Heater, Lamp, Laptop, Monitor, Speaker", actual = devices });
    }

    [Check("empty-strip-works")]
    static void EmptyStripWorks()
    {
        var empty = new PowerStrip(2000);
        var watts = ((IPlug)empty).Watts();
        var devices = Show(((IPlug)empty).Devices());
        var (house, _) = ThreeLevels();
        house.Add(new PowerStrip(1000));
        var withEmpty = ((IPlug)house).Watts();

        Expect.That(watts == 0 && devices == "nothing", "emptyNotEmpty", new { watts, devices });
        Expect.That(!empty.Overloaded(), "emptyOverloaded");
        Expect.That(withEmpty == 1655, "emptyChangedWatts", new { actual = withEmpty });
    }

    [Check("overloaded-counts-everything")]
    static void OverloadedCountsEverything()
    {
        var single = new PowerStrip(2000);
        single.Add(new Appliance("Kettle", 2200));
        var inner = new PowerStrip(1000);
        inner.Add(new Appliance("Toaster", 900));
        var outer = new PowerStrip(3000);
        outer.Add(new Appliance("Kettle", 2200));
        outer.Add(inner);
        var full = new PowerStrip(965);
        full.Add(new Appliance("Laptop", 65));
        full.Add(new Appliance("Iron", 900));

        Expect.That(single.Overloaded(), "singleNotOverloaded");
        Expect.That(outer.Overloaded() && !inner.Overloaded(), "nestedWrong", new { outer = outer.Overloaded(), inner = inner.Overloaded() });
        Expect.That(!full.Overloaded(), "atLimitOverloaded");
    }

    [Check("socket-takes-either")]
    static void SocketTakesEither()
    {
        var (house, _) = ThreeLevels();
        var strip = new WallSocket(house).Report();
        var one = new WallSocket(new Appliance("Fridge", 150)).Report();
        var empty = new WallSocket(new PowerStrip(1000)).Report();

        Expect.That(strip == "1655 W: Heater, Lamp, Laptop, Monitor, Speaker", "wrongStripReport", new { expected = "1655 W: Heater, Lamp, Laptop, Monitor, Speaker", actual = strip });
        Expect.That(one == "150 W: Fridge", "wrongApplianceReport", new { expected = "150 W: Fridge", actual = one });
        Expect.That(empty == "0 W: nothing", "wrongEmptyReport", new { expected = "0 W: nothing", actual = empty });
    }

    [Check("one-plug-interface")]
    static void OnePlugInterface()
    {
        Expect.That(typeof(IPlug).IsAssignableFrom(typeof(Appliance)), "applianceNotAPlug");
        Expect.That(typeof(IPlug).IsAssignableFrom(typeof(PowerStrip)), "stripNotAPlug");

        var stripFields = typeof(PowerStrip).GetFields(Declared);
        Expect.That(stripFields.Any(f => Inside(f.FieldType).Contains(typeof(IPlug))), "noPlugField");
        Expect.That(!stripFields.SelectMany(f => Inside(f.FieldType)).Contains(typeof(Appliance)), "stripHoldsAppliances");

        var named = typeof(WallSocket).GetFields(Declared).SelectMany(f => Inside(f.FieldType))
            .FirstOrDefault(t => t == typeof(Appliance) || t == typeof(PowerStrip));
        Expect.That(named is null, "socketNamesKind", new { type = named?.Name });

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "PowerStrip"))
        {
            var mentions = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Any(n => n.Identifier.ValueText == "Appliance");
            Expect.That(!mentions, "stripNamesAppliance");
        }
    }
}
