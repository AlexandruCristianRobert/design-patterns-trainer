using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SignShopChecks
{
    // A machine the program has never seen. It names each step plainly, so the result shows which steps a sign asked for.
    sealed class TestCutter : ICutter
    {
        public string Straight(int cm) => $"straight {cm}";
        public string Circle(int cm) => $"circle {cm}";
    }

    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // True when `type` or one of its base classes keeps an instance field of type `held`.
    static bool Keeps(Type type, Type held)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            if (t.GetFields(Declared).Any(f => f.FieldType == held)) return true;
        return false;
    }

    // No class that is `top` or derives from it names one of the program's classes that implement `held`.
    static void NamesNoMachineClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t) && t.DeclaringType != typeof(SignShopChecks))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesMachine", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    static string Steps(Sign sign) => string.Join(" | ", sign.Cut());

    [Check("vinyl-plotter-cuts-in-millimetres")]
    static void VinylPlotterCutsInMillimetres()
    {
        ICutter plotter = new VinylPlotter();
        var straight = plotter.Straight(40);
        var circle = plotter.Circle(25);

        Expect.That(straight == "plot straight 400 mm", "wrongStraight", new { actual = straight });
        Expect.That(circle == "plot circle 250 mm", "wrongCircle", new { actual = circle });
    }

    [Check("arrow-sign-cuts-shaft-and-head")]
    static void ArrowSignCutsShaftAndHead()
    {
        var even = Steps(new ArrowSign(new TestCutter(), 60));
        var odd = Steps(new ArrowSign(new TestCutter(), 25));

        Expect.That(even == "straight 60 | straight 30 | straight 30", "wrongArrow", new { length = 60, actual = even, expected = "straight 60 | straight 30 | straight 30" });
        Expect.That(odd == "straight 25 | straight 12 | straight 12", "wrongArrow", new { length = 25, actual = odd, expected = "straight 25 | straight 12 | straight 12" });
    }

    [Check("every-sign-on-both-machines")]
    static void EverySignOnBothMachines()
    {
        (string Sign, string Machine, Sign Made, string Expected)[] pairs =
        [
            ("square sign of 40", "laser cutter", new SquareSign(new LaserCutter(), 40), "laser straight 40 cm | laser straight 40 cm | laser straight 40 cm | laser straight 40 cm"),
            ("round sign of 25", "vinyl plotter", new RoundSign(new VinylPlotter(), 25), "plot circle 250 mm"),
            ("arrow sign of 60", "laser cutter", new ArrowSign(new LaserCutter(), 60), "laser straight 60 cm | laser straight 30 cm | laser straight 30 cm"),
            ("arrow sign of 60", "vinyl plotter", new ArrowSign(new VinylPlotter(), 60), "plot straight 600 mm | plot straight 300 mm | plot straight 300 mm"),
        ];
        foreach (var (sign, machine, made, expected) in pairs)
        {
            var actual = Steps(made);
            Expect.That(actual == expected, "wrongPair", new { sign, machine, actual, expected });
        }
    }

    [Check("arrow-sign-uses-the-machine-it-holds")]
    static void ArrowSignUsesTheMachineItHolds()
    {
        Expect.That(typeof(Sign).IsAssignableFrom(typeof(ArrowSign)), "notASign");
        Expect.That(Keeps(typeof(ArrowSign), typeof(ICutter)), "holdsNoCutter");
        NamesNoMachineClass(typeof(Sign), typeof(ICutter));
    }
}
