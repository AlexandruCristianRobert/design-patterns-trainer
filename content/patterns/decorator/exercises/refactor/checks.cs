using System.Reflection;
using DesignPatterns.Checks;

static class RentalChecks
{
    // A rental the program has never seen: 100 per day.
    sealed class TestVan : IRental
    {
        public int PricePerDay() => 100;
        public string Summary() => "test van";
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

    // The public constructor that takes exactly one IRental, or null.
    static ConstructorInfo? RentalConstructor(Type type) =>
        type.GetConstructors().FirstOrDefault(c => c.GetParameters() is [var p] && p.ParameterType == typeof(IRental));

    // Classes written in the program (not in these checks).
    static IEnumerable<Type> ProgramClasses() =>
        typeof(IRental).Assembly.GetTypes().Where(t => t.IsClass && t.DeclaringType != typeof(RentalChecks) &&
            !t.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)));

    static string Show(IRental rental) => $"{rental.Summary()}: {rental.PricePerDay()} per day";

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "hatchback: 30 per day",
            "hatchback + GPS: 35 per day",
            "estate + child seat: 53 per day",
            "estate + GPS + child seat: 58 per day",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("extras-work-on-any-rental")]
    static void ExtrasWorkOnAnyRental()
    {
        var gpsCtor = RentalConstructor(Code.Type("Gps").Clr);
        var seatCtor = RentalConstructor(Code.Type("ChildSeat").Clr);
        Expect.That(gpsCtor is not null, "noRentalConstructor", new { type = "Gps" });
        Expect.That(seatCtor is not null, "noRentalConstructor", new { type = "ChildSeat" });

        var gps = Show((IRental)gpsCtor!.Invoke([new TestVan()]));
        var seat = Show((IRental)seatCtor!.Invoke([new TestVan()]));

        Expect.That(gps == "test van + GPS: 105 per day", "wrongGps", new { actual = gps });
        Expect.That(seat == "test van + child seat: 108 per day", "wrongChildSeat", new { actual = seat });
    }

    [Check("extras-stack-in-any-order")]
    static void ExtrasStackInAnyOrder()
    {
        var gpsCtor = RentalConstructor(Code.Type("Gps").Clr);
        var seatCtor = RentalConstructor(Code.Type("ChildSeat").Clr);
        Expect.That(gpsCtor is not null, "noRentalConstructor", new { type = "Gps" });
        Expect.That(seatCtor is not null, "noRentalConstructor", new { type = "ChildSeat" });
        IRental AddGps(IRental r) => (IRental)gpsCtor!.Invoke([r]);
        IRental AddSeat(IRental r) => (IRental)seatCtor!.Invoke([r]);

        var seatLast = Show(AddSeat(AddGps(new TestVan())));
        var twoSeats = Show(AddGps(AddSeat(AddSeat(new TestVan()))));

        Expect.That(seatLast == "test van + GPS + child seat: 113 per day", "wrongSeatLast", new { actual = seatLast });
        Expect.That(twoSeats == "test van + child seat + child seat + GPS: 121 per day", "wrongTwoSeats", new { actual = twoSeats });
    }

    [Check("no-class-per-combination")]
    static void NoClassPerCombination()
    {
        var rental = typeof(IRental);
        var classes = ProgramClasses().ToList();

        var subclass = classes.FirstOrDefault(t => t != typeof(CarRental) && typeof(CarRental).IsAssignableFrom(t));
        Expect.That(subclass is null, "extendsCar", new { type = subclass?.Name });

        string[] allowed = ["CarRental", "Gps", "ChildSeat"];
        var extra = classes.FirstOrDefault(t => !t.IsAbstract && rental.IsAssignableFrom(t) && !allowed.Contains(t.Name));
        Expect.That(extra is null, "otherRentalClass", new { type = extra?.Name });

        foreach (var type in new[] { Code.Type("Gps").Clr, Code.Type("ChildSeat").Clr })
        {
            Expect.That(rental.IsAssignableFrom(type), "notARental", new { type = type.Name });

            var fields = Fields(type);
            Expect.That(fields.Any(f => f.FieldType == rental), "holdsNoRental", new { type = type.Name });

            var concrete = fields.FirstOrDefault(f => f.FieldType != rental && rental.IsAssignableFrom(f.FieldType));
            Expect.That(concrete is null, "holdsConcreteRental", new { type = type.Name, held = concrete?.FieldType.Name });
        }
    }
}
