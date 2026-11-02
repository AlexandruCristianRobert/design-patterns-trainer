using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class EmbroideryChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // True when `type` or one of its base classes keeps an instance field of type `held`.
    static bool Keeps(Type type, Type held)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            if (t.GetFields(Declared).Any(f => f.FieldType == held)) return true;
        return false;
    }

    // No class that is `top` or derives from it names one of the program's classes that implement or derive from `held`, or has a switch.
    static void NamesNoMachineClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var user = declaration.Identifier.ValueText;
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesMachine", new { user, type = named });
            var switches = declaration.DescendantNodes().Any(n => n is SwitchStatementSyntax or SwitchExpressionSyntax);
            Expect.That(!switches, "designSwitches", new { user });
        }
    }

    // A new object of the class called `name`, made through its public constructor without parameters.
    static object NewMachine(string name)
    {
        var type = Code.Type(name).Clr;
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = name });
        return ctor.Invoke(null);
    }

    // A new design through its public constructor that takes the machine and then `second`.
    static Design NewDesign(Type design, object machine, object second)
    {
        var ctor = design.GetConstructors().FirstOrDefault(c => c.GetParameters() is [var m, var s]
            && m.ParameterType.IsInstanceOfType(machine) && s.ParameterType == second.GetType());
        if (ctor is null) Expect.Fail("noDesignConstructor", new { type = design.Name, machine = machine.GetType().Name, second = second.GetType().Name });
        return (Design)ctor.Invoke([machine, second]);
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "fill stitch circle",
            "satin stitch \"AB\"",
            "FIL shield",
            "FIL star",
            "FIL star",
            "FIL circle",
            "SAT Z",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("each-machine-sews-its-own-way")]
    static void EachMachineSewsItsOwnWay()
    {
        (string Machine, string Method, string Argument, string Expected)[] stitches =
        [
            ("HomeMachine", "Satin", "Jo", "satin stitch \"Jo\""),
            ("HomeMachine", "Fill", "heart", "fill stitch heart"),
            ("StudioMachine", "Satin", "Jo", "SAT Jo"),
            ("StudioMachine", "Fill", "heart", "FIL heart"),
        ];
        foreach (var (machine, method, argument, expected) in stitches)
        {
            var instance = NewMachine(machine);
            var found = instance.GetType().GetMethod(method, [typeof(string)]);
            if (found is null || found.ReturnType != typeof(string)) Expect.Fail("noStitchMethod", new { type = machine, method });
            var actual = (string?)found.Invoke(instance, [argument]);
            Expect.That(actual == expected, "wrongStitch", new { type = machine, method, argument, actual, expected });
        }
    }

    [Check("every-design-on-every-machine")]
    static void EveryDesignOnEveryMachine()
    {
        (Type Design, object Second, string Machine, string Expected)[] pairs =
        [
            (typeof(Monogram), "Jo", "HomeMachine", "fill stitch circle | satin stitch \"Jo\""),
            (typeof(Monogram), "Jo", "StudioMachine", "FIL circle | SAT Jo"),
            (typeof(Badge), 1, "HomeMachine", "fill stitch shield | fill stitch star"),
            (typeof(Badge), 1, "StudioMachine", "FIL shield | FIL star"),
        ];
        foreach (var (design, second, machine, expected) in pairs)
        {
            var actual = string.Join(" | ", NewDesign(design, NewMachine(machine), second).Stitch());
            Expect.That(actual == expected, "wrongPair", new { design = design.Name, second, machine, actual, expected });
        }
    }

    [Check("designs-hold-a-machine")]
    static void DesignsHoldAMachine()
    {
        var machine = Code.Type("Machine").Clr;
        Expect.That(machine.IsInterface || machine.IsAbstract, "machineNotAbstract");
        foreach (var method in new[] { "Satin", "Fill" })
        {
            var found = machine.GetMethod(method, [typeof(string)]);
            Expect.That(found is not null && found.ReturnType == typeof(string), "noStitchMethod", new { type = "Machine", method });
        }
        foreach (var name in new[] { "HomeMachine", "StudioMachine" })
            Expect.That(machine.IsAssignableFrom(Code.Type(name).Clr), "notAMachine", new { type = name });
        foreach (var design in new[] { typeof(Monogram), typeof(Badge) })
        {
            Expect.That(typeof(Design).IsAssignableFrom(design), "notADesign", new { type = design.Name });
            Expect.That(Keeps(design, machine), "holdsNoMachine", new { type = design.Name });
        }
        NamesNoMachineClass(typeof(Design), machine);
    }
}
