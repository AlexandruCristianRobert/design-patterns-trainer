using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class FrameShopChecks
{
    // A kind of frame for the Checks only, with its own line for every step.
    sealed class Probe : FrameOrder
    {
        protected override string CutMoulding() => "probe moulding";
        protected override string FitGlazing() => "probe glazing";
        protected override string Extra() => "probe extra";
    }

    static string Lines(FrameOrder order) => string.Join(" | ", order.Make());

    [Check("make-runs-every-step-in-order")]
    static void MakeRunsEveryStepInOrder()
    {
        var lines = Lines(new Probe());
        const string expected = "measure the picture | probe moulding | probe glazing | assemble and fit the hanging wire | probe extra";
        Expect.That(lines == expected, "wrongLines", new { expected, actual = lines });
    }

    [Check("no-extra-by-default")]
    static void NoExtraByDefault()
    {
        var lines = Lines(new WoodFrame());
        const string expected = "measure the picture | cut oak moulding | fit glass | assemble and fit the hanging wire";
        Expect.That(lines == expected, "defaultExtraAdded", new { expected, actual = lines });
    }

    [Check("metal-frame-lines")]
    static void MetalFrameLines()
    {
        var extra = typeof(MetalFrame).GetMethods(Declared).FirstOrDefault(m => m.Name == "Extra");
        Expect.That(extra is not null && extra.GetBaseDefinition().DeclaringType == typeof(FrameOrder), "extraNotOverridden");

        var lines = Lines(new MetalFrame());
        const string expected = "measure the picture | cut aluminium profile | fit acrylic | assemble and fit the hanging wire | add corner protectors";
        Expect.That(lines == expected, "wrongMetal", new { expected, actual = lines });
    }

    [Check("the-order-is-fixed-in-frame-order")]
    static void TheOrderIsFixedInFrameOrder()
    {
        var make = typeof(FrameOrder).GetMethod("Make", Declared, Type.EmptyTypes);
        if (make is null) Expect.Fail("noMake");
        Expect.That(!make.IsVirtual || make.IsFinal, "makeOverridable");

        foreach (var kind in new[] { typeof(WoodFrame), typeof(MetalFrame) })
            for (var t = kind; t != typeof(FrameOrder) && t is not null; t = t.BaseType)
                Expect.That(!t.GetMethods(Declared).Any(m => m.Name == "Make"), "makeRedeclared", new { type = t.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "FrameOrder")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "WoodFrame" or "MetalFrame");
        Expect.That(named is null, "namesAKind", new { type = named?.Identifier.ValueText });
    }

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;
}
