using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PharmacyChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly Type[] Parts = [typeof(Prescriptions), typeof(PriceList), typeof(CardReader), typeof(ShelfRobot)];

    // A new Pickup with an empty log. Pickup is either created with the four classes (in any order)
    // or has a public constructor without parameters and creates them itself; both are accepted.
    static Pickup NewPickup()
    {
        PickupLog.Lines.Clear();
        foreach (var constructor in typeof(Pickup).GetConstructors())
        {
            var types = constructor.GetParameters().Select(p => p.ParameterType).ToArray();
            if (types.Length == Parts.Length && Parts.All(types.Contains))
                return (Pickup)constructor.Invoke(types.Select(t => t.GetConstructor(Type.EmptyTypes)!.Invoke(null)).ToArray());
        }
        var plain = typeof(Pickup).GetConstructor(Type.EmptyTypes);
        if (plain is not null) return (Pickup)plain.Invoke(null);
        Expect.Fail("noPickupConstructor");
        return null!;
    }

    static string Log() => PickupLog.Lines.Count == 0 ? "nothing" : string.Join(" / ", PickupLog.Lines);

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("records-and-prices-work-on-their-own")]
    static void RecordsAndPricesWorkOnTheirOwn()
    {
        PickupLog.Lines.Clear();
        var prescriptions = new Prescriptions();
        string?[] found = [prescriptions.Medicine("RX100"), prescriptions.Medicine("RX200"), prescriptions.Medicine("RX300"), prescriptions.Medicine("rx100")];
        var log = Log();
        var prices = new PriceList();
        int[] cents = [prices.Cents("Aspirin"), prices.Cents("Insulin"), prices.Cents("Ibuprofen")];

        Expect.That(found.SequenceEqual(["Aspirin", "Insulin", "Ibuprofen", null]), "wrongMedicines", new { actual = string.Join(", ", found.Select(m => m ?? "null")) });
        Expect.That(log == "found Aspirin for RX100 / found Insulin for RX200 / found Ibuprofen for RX300 / no prescription rx100", "wrongRecordsLog", new { expected = "found Aspirin for RX100 / found Insulin for RX200 / found Ibuprofen for RX300 / no prescription rx100", actual = log });
        Expect.That(cents.SequenceEqual([450, 0, 1275]), "wrongPrices", new { actual = string.Join(", ", cents) });
    }

    [Check("collect-runs-the-steps-in-order")]
    static void CollectRunsTheStepsInOrder()
    {
        var medicine = NewPickup().Collect("RX300");
        var log = Log();

        Expect.That(log == "found Ibuprofen for RX300 / charged 12 EUR 75 / robot fetches Ibuprofen", "wrongSteps", new { expected = "found Ibuprofen for RX300 / charged 12 EUR 75 / robot fetches Ibuprofen", actual = log });
        Expect.That(medicine == "Ibuprofen", "wrongMedicine", new { actual = medicine ?? "null", expected = "Ibuprofen" });
    }

    [Check("typed-codes-are-tidied")]
    static void TypedCodesAreTidied()
    {
        var medicine = NewPickup().Collect("  rx100 ");
        var log = Log();

        Expect.That(log == "found Aspirin for RX100 / charged 4 EUR 50 / robot fetches Aspirin", "untidyCode", new { expected = "found Aspirin for RX100 / charged 4 EUR 50 / robot fetches Aspirin", actual = log });
        Expect.That(medicine == "Aspirin", "wrongMedicine", new { actual = medicine ?? "null", expected = "Aspirin" });
    }

    [Check("free-medicine-is-not-charged")]
    static void FreeMedicineIsNotCharged()
    {
        var medicine = NewPickup().Collect("RX200");
        var log = Log();

        Expect.That(log == "found Insulin for RX200 / robot fetches Insulin", "chargedForFree", new { expected = "found Insulin for RX200 / robot fetches Insulin", actual = log });
        Expect.That(medicine == "Insulin", "wrongMedicine", new { actual = medicine ?? "null", expected = "Insulin" });
    }

    [Check("unknown-code-stops-the-rest")]
    static void UnknownCodeStopsTheRest()
    {
        var medicine = NewPickup().Collect("rx999");
        var log = Log();

        Expect.That(log == "no prescription RX999", "stepsAfterUnknown", new { expected = "no prescription RX999", actual = log });
        Expect.That(medicine is null, "medicineForUnknown", new { actual = medicine });
    }

    [Check("tablet-knows-only-pickup")]
    static void TabletKnowsOnlyPickup()
    {
        var tablet = new CounterTablet(NewPickup());
        var found = tablet.Scan("rx100");
        var missing = tablet.Scan("rx404");
        Expect.That(found == "Aspirin is on its way" && missing == "No prescription for rx404", "wrongReplies", new { found, missing });

        var type = typeof(CounterTablet);
        var parameter = type.GetConstructors().SelectMany(c => c.GetParameters()).FirstOrDefault(p => Parts.Contains(p.ParameterType));
        Expect.That(parameter is null, "tabletTakesPart", new { type = parameter?.ParameterType.Name });
        var field = type.GetFields(Declared).SelectMany(f => Inside(f.FieldType)).FirstOrDefault(Parts.Contains);
        Expect.That(field is null, "tabletKeepsPart", new { type = field?.Name });

        var names = Parts.Select(p => p.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "CounterTablet"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().FirstOrDefault(n => names.Contains(n.Identifier.ValueText));
            Expect.That(named is null, "tabletNamesPart", new { type = named?.Identifier.ValueText });
        }
    }
}
