using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class HotelKeyChecks
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

    // The source of `owner` names none of the program's classes that implement `made`, and has no switch.
    static void NamesNoMadeClass(string owner, Type made)
    {
        var classes = made.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(HotelKeyChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == owner))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "ownerNamesMadeClass", new { owner, type = named });
            var switches = declaration.DescendantNodes().Any(n => n is SwitchStatementSyntax or SwitchExpressionSyntax);
            Expect.That(!switches, "ownerSwitches", new { owner });
        }
    }

    // Asks a new `type` twice through `making` and expects two new objects of class `expected`.
    static void MakesItsOwn(MethodInfo making, Type type, Type expected, params object[] args)
    {
        var instance = New(type);
        var first = making.Invoke(instance, args);
        var second = making.Invoke(instance, args);
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type = type.Name, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = making.Name });
    }

    static CheckInDesk New(Type type)
    {
        Expect.That(typeof(CheckInDesk).IsAssignableFrom(type), "notASubclass", new { type = type.Name, owner = "CheckInDesk" });
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        return (CheckInDesk)ctor.Invoke(null);
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Welcome, Ana: key card for room 12",
            "Welcome, Radu: key card for room 204",
            "Welcome, Zoe: PIN 1147 for room 31",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("card-desk-hands-out-key-cards")]
    static void CardDeskHandsOutKeyCards()
    {
        var desk = New(Code.Type("CardDesk").Clr);
        var line = desk.CheckIn("Test guest", 7);

        Expect.That(line == "Welcome, Test guest: key card for room 7", "wrongCardDesk", new { actual = line });
    }

    [Check("pin-desk-hands-out-pin-codes")]
    static void PinDeskHandsOutPinCodes()
    {
        var desk = New(Code.Type("PinDesk").Clr);
        var line = desk.CheckIn("Test guest", 7);

        Expect.That(line == "Welcome, Test guest: PIN 0259 for room 7", "wrongPinDesk", new { actual = line });
    }

    [Check("desk-is-not-told-the-key")]
    static void DeskIsNotToldTheKey()
    {
        var desk = typeof(CheckInDesk);
        var told = desk.GetConstructors(Instance).SelectMany(c => c.GetParameters())
            .FirstOrDefault(p => p.ParameterType == typeof(string) || p.ParameterType == typeof(bool) || p.ParameterType.IsEnum || p.ParameterType == typeof(Type));
        Expect.That(told is null, "deskTakesKind", new { parameter = told?.Name });

        NamesNoMadeClass("CheckInDesk", typeof(IRoomKey));
        var making = MakingMethod(desk, typeof(IRoomKey), typeof(int));
        var cardDesk = Code.Type("CardDesk").Clr;
        var pinDesk = Code.Type("PinDesk").Clr;
        OperationWrittenOnce(desk, "CheckIn", cardDesk, pinDesk);
        MakesItsOwn(making, cardDesk, typeof(KeyCard), 7);
        MakesItsOwn(making, pinDesk, typeof(PinCode), 7);
    }
}
