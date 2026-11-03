using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class AquariumChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // Every public constructor of `user` takes exactly one thing: an interface or an abstract class that is none of `parts`.
    // That type is what makes the parts, and it is returned.
    static Type Maker(Type user, params Type[] parts)
    {
        var ctors = user.GetConstructors();
        if (ctors.Length == 0) Expect.Fail("noPublicConstructor", new { user = user.Name });
        Type maker = null!;
        foreach (var ctor in ctors)
        {
            var parameters = ctor.GetParameters();
            Expect.That(parameters.Length == 1, "constructorShape", new { user = user.Name, parameters = string.Join(", ", parameters.Select(p => p.ParameterType.Name)) });
            maker = parameters[0].ParameterType;
            Expect.That(!parts.Any(k => k.IsAssignableFrom(maker)), "constructorTakesPart", new { user = user.Name, type = maker.Name });
            Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { user = user.Name, maker = maker.Name });
        }
        return maker;
    }

    // The method `maker` declares that returns a `made`: it takes no parameters, the code that uses `maker` can call it, and each subtype can fill it in.
    static MethodInfo MakingMethod(Type maker, Type made)
    {
        var found = maker.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { maker = maker.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Length == 0);
        if (method is null) Expect.Fail("makingMethodParameters", new { maker = maker.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { maker = maker.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsAssembly || method.IsFamilyOrAssembly, "makingMethodHidden", new { maker = maker.Name, method = method.Name });
        return method;
    }

    // `type` derives from `maker`, and each of `methods` makes a new object of the matching `expected` class on every call.
    static void MakesOneSet(Type type, Type maker, MethodInfo[] methods, params Type[] expected)
    {
        Expect.That(type != maker && maker.IsAssignableFrom(type), "notAMaker", new { type = type.Name, maker = maker.Name });
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        var instance = ctor.Invoke(null);
        for (var i = 0; i < methods.Length; i++)
        {
            var first = methods[i].Invoke(instance, null);
            var second = methods[i].Invoke(instance, null);
            Expect.That(first?.GetType() == expected[i], "makesWrongClass", new { type = type.Name, method = methods[i].Name, expected = expected[i].Name, actual = first?.GetType().Name ?? "null" });
            Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = methods[i].Name });
        }
    }

    // The source of `user` names none of the program's classes that implement or derive from any of `kinds`, and has no switch.
    static void NamesNoConcreteClass(string user, params Type[] kinds)
    {
        var classes = kinds[0].Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(AquariumChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == user))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "userNamesConcreteClass", new { user, type = named });
            var switches = declaration.DescendantNodes().Any(n => n is SwitchStatementSyntax or SwitchExpressionSyntax);
            Expect.That(!switches, "userSwitches", new { user });
        }
    }

    // A TankPlanner created with a new object of the class called `supplier`.
    static TankPlanner PlannerWith(string supplier)
    {
        var type = Code.Type(supplier).Clr;
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        var instance = ctor.Invoke(null);
        var plannerCtor = typeof(TankPlanner).GetConstructors().FirstOrDefault(c => c.GetParameters() is [var p] && p.ParameterType.IsInstanceOfType(instance));
        if (plannerCtor is null) Expect.Fail("plannerRefusesSupplier", new { type = type.Name });
        return (TankPlanner)plannerCtor.Invoke([instance]);
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Living room, 60 L: sponge filter, 240 L/h, flake food",
            "Reef, 200 L: protein skimmer, 2000 L/h, frozen brine shrimp",
            "Office, 25 L: sponge filter, 100 L/h, flake food",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("freshwater-supplier-plans-freshwater-tanks")]
    static void FreshwaterSupplierPlansFreshwaterTanks()
    {
        var line = PlannerWith("FreshwaterSupplier").Plan("Test tank", 50);

        Expect.That(line == "Test tank, 50 L: sponge filter, 200 L/h, flake food", "wrongFreshwater", new { expected = "Test tank, 50 L: sponge filter, 200 L/h, flake food", actual = line });
    }

    [Check("marine-supplier-plans-marine-tanks")]
    static void MarineSupplierPlansMarineTanks()
    {
        var line = PlannerWith("MarineSupplier").Plan("Test tank", 50);

        Expect.That(line == "Test tank, 50 L: protein skimmer, 500 L/h, frozen brine shrimp", "wrongMarine", new { expected = "Test tank, 50 L: protein skimmer, 500 L/h, frozen brine shrimp", actual = line });
    }

    [Check("planner-is-handed-one-supplier")]
    static void PlannerIsHandedOneSupplier()
    {
        var maker = Maker(typeof(TankPlanner), typeof(IFilter), typeof(IFishFood));
        MethodInfo[] methods = [MakingMethod(maker, typeof(IFilter)), MakingMethod(maker, typeof(IFishFood))];
        MakesOneSet(Code.Type("FreshwaterSupplier").Clr, maker, methods, typeof(SpongeFilter), typeof(FlakeFood));
        MakesOneSet(Code.Type("MarineSupplier").Clr, maker, methods, typeof(ProteinSkimmer), typeof(FrozenShrimp));
        NamesNoConcreteClass("TankPlanner", typeof(IFilter), typeof(IFishFood), maker);
    }
}
