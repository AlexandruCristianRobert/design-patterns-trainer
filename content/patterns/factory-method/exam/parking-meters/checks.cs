using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ParkingMeterChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // The method `owner` declares that returns a `made`: abstract or virtual, public or protected, taking `parameters`.
    static MethodInfo MakingMethod(Type owner, Type made, params Type[] parameters)
    {
        var found = owner.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { owner = owner.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Select(p => p.ParameterType).SequenceEqual(parameters));
        if (method is null) Expect.Fail("makingMethodParameters", new { owner = owner.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { owner = owner.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsFamily || method.IsFamilyOrAssembly, "makingMethodPrivate", new { owner = owner.Name, method = method.Name });
        return method;
    }

    // Each subclass derives from `owner`, and neither it nor a class between them declares its own `operation`.
    static void OperationWrittenOnce(Type owner, string operation, params Type[] subclasses)
    {
        foreach (var sub in subclasses)
        {
            Expect.That(sub != owner && owner.IsAssignableFrom(sub), "notASubclass", new { type = sub.Name, owner = owner.Name });
            for (var t = sub; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Instance | BindingFlags.DeclaredOnly).Any(m => m.Name == operation),
                    "operationRedeclared", new { type = t.Name, method = operation });
        }
    }

    // The source of `owner` names none of the program's classes that implement `made`.
    static void NamesNoMadeClass(string owner, Type made)
    {
        var classes = made.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(ParkingMeterChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == owner))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "ownerNamesMadeClass", new { owner, type = named });
        }
    }

    // Asks a new `type` twice through `making` and expects two new objects of class `expected`.
    static void MakesItsOwn(MethodInfo making, Type type, Type expected)
    {
        var instance = Activator.CreateInstance(type);
        var first = making.Invoke(instance, null);
        var second = making.Invoke(instance, null);
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type = type.Name, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = making.Name });
    }

    [Check("receipts-show-the-payment")]
    static void ReceiptsShowThePayment()
    {
        var paper = new PaperReceipt().Show(61, 300);
        var app = new AppReceipt().Show(45, 150);
        var cents = new PaperReceipt().Show(5, 1205);

        Expect.That(paper == "PAID 61 MIN 3.00 EUR", "wrongPaper", new { actual = paper });
        Expect.That(cents == "PAID 5 MIN 12.05 EUR", "wrongPaperCents", new { actual = cents });
        Expect.That(app == "Parking: 45 min, 150 cents", "wrongApp", new { actual = app });
    }

    [Check("each-meter-gives-its-own-receipt")]
    static void EachMeterGivesItsOwnReceipt()
    {
        var street = new StreetMeter().Pay(45);
        var garage = new GarageMeter().Pay(130);

        Expect.That(street == "PAID 45 MIN 1.50 EUR", "wrongStreet", new { actual = street });
        Expect.That(garage == "Parking: 130 min, 450 cents", "wrongGarage", new { actual = garage });
    }

    [Check("price-per-started-hour")]
    static void PricePerStartedHour()
    {
        ParkingMeter meter = new GarageMeter();
        var prices = string.Join(", ", new[] { 1, 60, 61, 180 }.Select(m => meter.Pay(m)));

        Expect.That(prices == "Parking: 1 min, 150 cents, Parking: 60 min, 150 cents, Parking: 61 min, 300 cents, Parking: 180 min, 450 cents",
            "wrongPrices", new { actual = prices });
        Expect.That(meter.TakenCents == 1050, "wrongTaken", new { taken = meter.TakenCents });
    }

    [Check("meter-is-not-told-the-receipt")]
    static void MeterIsNotToldTheReceipt()
    {
        var meter = typeof(ParkingMeter);
        var told = meter.GetConstructors(Instance).SelectMany(c => c.GetParameters())
            .FirstOrDefault(p => p.ParameterType == typeof(string) || p.ParameterType == typeof(bool) || p.ParameterType.IsEnum || p.ParameterType == typeof(Type));
        Expect.That(told is null, "meterTakesKind", new { parameter = told?.Name });

        var switches = Source.Root.DescendantNodes().Any(n => n is SwitchStatementSyntax or SwitchExpressionSyntax);
        Expect.That(!switches, "programSwitches");

        var maker = meter.Assembly.GetTypes().Where(t => t.DeclaringType != typeof(ParkingMeterChecks))
            .SelectMany(t => t.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
            .FirstOrDefault(m => m.ReturnType == typeof(IReceipt));
        Expect.That(maker is null, "staticReceiptMaker", new { method = maker?.Name });

        var making = MakingMethod(meter, typeof(IReceipt));
        OperationWrittenOnce(meter, "Pay", typeof(StreetMeter), typeof(GarageMeter));
        NamesNoMadeClass("ParkingMeter", typeof(IReceipt));
        MakesItsOwn(making, typeof(StreetMeter), typeof(PaperReceipt));
        MakesItsOwn(making, typeof(GarageMeter), typeof(AppReceipt));
    }
}
