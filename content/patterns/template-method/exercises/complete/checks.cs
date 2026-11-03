using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class FrameShopChecks
{
    // A kind of frame for the Checks only. It writes down each step FrameOrder asks it for, and adds an extra step.
    sealed class Probe(List<string> calls) : FrameOrder
    {
        protected override string CutMoulding(int length)
        {
            calls.Add($"CutMoulding({length})");
            return $"probe moulding {length}";
        }

        protected override string FitGlazing()
        {
            calls.Add("FitGlazing");
            return "probe glazing";
        }

        protected override string Extra()
        {
            calls.Add("Extra");
            return "probe extra";
        }
    }

    // A kind of frame for the Checks only that keeps the default Extra.
    sealed class Plain : FrameOrder
    {
        protected override string CutMoulding(int length) => $"plain moulding {length}";
        protected override string FitGlazing() => "plain glazing";
    }

    static string Lines(FrameOrder order, int width, int height) => string.Join(" | ", order.Make(width, height));

    [Check("make-runs-every-step-in-order")]
    static void MakeRunsEveryStepInOrder()
    {
        foreach (var (width, height) in new[] { (30, 40), (25, 25) })
        {
            var calls = new List<string>();
            var lines = Lines(new Probe(calls), width, height);
            var length = 2 * width + 2 * height;

            var asked = string.Join(", ", calls);
            var expectedCalls = $"CutMoulding({length}), FitGlazing, Extra";
            Expect.That(asked == expectedCalls, "wrongCalls", new { width, height, expected = expectedCalls, actual = asked });

            var expected = $"measure {width} x {height} cm | probe moulding {length} | probe glazing | assemble and fit the hanging wire | probe extra";
            Expect.That(lines == expected, "wrongLines", new { width, height, expected, actual = lines });
        }
    }

    [Check("no-extra-by-default")]
    static void NoExtraByDefault()
    {
        var lines = Lines(new Plain(), 20, 30);
        const string expected = "measure 20 x 30 cm | plain moulding 100 | plain glazing | assemble and fit the hanging wire";
        Expect.That(lines == expected, "defaultExtraAdded", new { expected, actual = lines });
    }

    [Check("wood-frame-lines")]
    static void WoodFrameLines()
    {
        FrameOrder order = new WoodFrame();
        var lines = Lines(order, 30, 40);
        const string expected = "measure 30 x 40 cm | cut 140 cm of oak moulding | fit glass | assemble and fit the hanging wire";
        Expect.That(lines == expected, "wrongWood", new { expected, actual = lines });
    }

    [Check("metal-frame-lines")]
    static void MetalFrameLines()
    {
        FrameOrder order = new MetalFrame();
        var lines = Lines(order, 50, 70);
        const string expected = "measure 50 x 70 cm | cut 240 cm of aluminium profile | fit acrylic | assemble and fit the hanging wire | add corner protectors";
        Expect.That(lines == expected, "wrongMetal", new { expected, actual = lines });
    }

    [Check("the-order-is-fixed-in-frame-order")]
    static void TheOrderIsFixedInFrameOrder()
    {
        var make = typeof(FrameOrder).GetMethod("Make", Declared, [typeof(int), typeof(int)]);
        if (make is null) Expect.Fail("noMake");
        Expect.That(!make.IsVirtual || make.IsFinal, "makeOverridable");

        foreach (var kind in new[] { typeof(WoodFrame), typeof(MetalFrame) })
            for (var t = kind; t != typeof(FrameOrder) && t is not null; t = t.BaseType)
                Expect.That(!t.GetMethods(Declared).Any(m => m.Name == "Make"), "makeRedeclared", new { type = t.Name });

        var extra = typeof(MetalFrame).GetMethods(Declared).FirstOrDefault(m => m.Name == "Extra");
        Expect.That(extra is not null && extra.GetBaseDefinition().DeclaringType == typeof(FrameOrder), "extraNotOverridden");

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "FrameOrder")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "WoodFrame" or "MetalFrame");
        Expect.That(named is null, "namesAKind", new { type = named?.Identifier.ValueText });
    }

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;
}
