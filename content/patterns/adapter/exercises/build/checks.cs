using System.Reflection;
using DesignPatterns.Checks;

static class ChargerChecks
{
    // A network the program has never seen. It hands out the chargers it was given.
    sealed class TestNetwork(params Charger[] chargers) : IChargerNetwork
    {
        public IReadOnlyList<Charger> Chargers() => chargers;
    }

    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every instance field of the type, including those declared in its base classes.
    static List<FieldInfo> Fields(Type type)
    {
        var fields = new List<FieldInfo>();
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            fields.AddRange(t.GetFields(Declared));
        return fields;
    }

    // AmpGrid's chargers for these rows. AmpGridChargers is either created with an AmpGridService,
    // or derives from AmpGridService and is created with the rows themselves; both are accepted.
    static IChargerNetwork AmpGridFor(params string[] rows)
    {
        var type = typeof(AmpGridChargers);
        if (!typeof(IChargerNetwork).IsAssignableFrom(type)) Expect.Fail("ampNotANetwork");

        var withService = type.GetConstructor([typeof(AmpGridService)]);
        if (withService is not null) return (IChargerNetwork)withService.Invoke([new AmpGridService(rows)]);

        var withRows = type.GetConstructor([typeof(string[])]);
        if (withRows is not null && typeof(AmpGridService).IsAssignableFrom(type)) return (IChargerNetwork)withRows.Invoke([rows]);

        Expect.Fail("noAmpConstructor");
        return null!;
    }

    static string Show(IEnumerable<Charger> chargers)
    {
        var shown = string.Join(", ", chargers.Select(c => $"{c.Name} {c.Kilowatts} kW {(c.Free ? "free" : "taken")}"));
        return shown == "" ? "nothing" : shown;
    }

    static string Show(IEnumerable<string> names)
    {
        var shown = string.Join(", ", names);
        return shown == "" ? "nothing" : shown;
    }

    [Check("volt-net-points-become-chargers")]
    static void VoltNetPointsBecomeChargers()
    {
        if (!typeof(IChargerNetwork).IsAssignableFrom(typeof(VoltNetChargers))) Expect.Fail("voltNotANetwork");
        var network = (IChargerNetwork)new VoltNetChargers(new VoltNetApi(
            new VoltPoint("VN-1", 7.4, "AVAILABLE"), new VoltPoint("VN-2", 49.9, "IN_USE"), new VoltPoint("VN-3", 150, "OFFLINE")));
        var chargers = Show(network.Chargers());
        var empty = Show(((IChargerNetwork)new VoltNetChargers(new VoltNetApi())).Chargers());

        Expect.That(chargers == "VN-1 7 kW free, VN-2 49 kW taken, VN-3 150 kW taken", "wrongVoltNet", new { actual = chargers });
        Expect.That(empty == "nothing", "voltNetMadeUpChargers", new { actual = empty });
    }

    [Check("amp-grid-rows-become-chargers")]
    static void AmpGridRowsBecomeChargers()
    {
        var chargers = Show(AmpGridFor("Mall level 2;22000;0", "Station road;50000;1", "Depot;3700;0").Chargers());
        var empty = Show(AmpGridFor().Chargers());

        Expect.That(chargers == "Mall level 2 22 kW free, Station road 50 kW taken, Depot 3 kW free", "wrongAmpGrid", new { actual = chargers });
        Expect.That(empty == "nothing", "ampGridMadeUpChargers", new { actual = empty });
    }

    [Check("map-asks-every-network")]
    static void MapAsksEveryNetwork()
    {
        var map = new ChargerMap(
        [
            new TestNetwork(new Charger("North", 11, true), new Charger("South", 50, false), new Charger("East", 22, true)),
            new TestNetwork(),
            new TestNetwork(new Charger("West", 150, true)),
        ]);
        var fast = Show(map.FreeChargers(20));
        var any = Show(map.FreeChargers(0));

        Expect.That(fast == "East, West", "wrongFast", new { actual = fast });
        Expect.That(any == "North, East, West", "wrongAny", new { actual = any });
    }

    [Check("both-networks-on-one-map")]
    static void BothNetworksOnOneMap()
    {
        var map = new ChargerMap(
        [
            AmpGridFor("Harbour;11000;0", "Airport;150000;0"),
            new VoltNetChargers(new VoltNetApi(new VoltPoint("VN-Park", 22.0, "AVAILABLE"), new VoltPoint("VN-Zoo", 50.0, "OFFLINE"))),
        ]);
        var names = Show(map.FreeChargers(22));

        Expect.That(names == "Airport, VN-Park", "wrongBoth", new { actual = names });
    }

    [Check("networks-plug-into-the-map")]
    static void NetworksPlugIntoTheMap()
    {
        var network = typeof(IChargerNetwork);
        Expect.That(network.IsAssignableFrom(typeof(VoltNetChargers)), "voltNotANetwork");
        Expect.That(network.IsAssignableFrom(typeof(AmpGridChargers)), "ampNotANetwork");
        Expect.That(!network.IsAssignableFrom(typeof(VoltNetApi)) && !network.IsAssignableFrom(typeof(AmpGridService)), "libraryChanged");

        Expect.That(Fields(typeof(VoltNetChargers)).Any(f => f.FieldType == typeof(VoltNetApi)), "voltKeepsNoApi");
        Expect.That(typeof(AmpGridService).IsAssignableFrom(typeof(AmpGridChargers)) ||
            Fields(typeof(AmpGridChargers)).Any(f => f.FieldType == typeof(AmpGridService)), "ampKeepsNoService");

        // The map may hold networks in any collection, as long as nothing in it names a particular network class.
        Type[] particular = [typeof(VoltNetApi), typeof(AmpGridService), typeof(VoltNetChargers), typeof(AmpGridChargers)];
        static IEnumerable<Type> Inside(Type t) =>
            new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                       .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);
        var named = Fields(typeof(ChargerMap)).SelectMany(f => Inside(f.FieldType)).FirstOrDefault(particular.Contains);
        Expect.That(named is null, "mapNamesNetwork", new { type = named?.Name });
    }
}
