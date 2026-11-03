using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PrintModelChecks
{
    static string Looks(PrintModel model) => $"scale {model.Scale}, angle {model.Angle}, material {model.Material}";

    // A model at scale 80, turned to 270 degrees, in PETG.
    static PrintModel Tweaked()
    {
        var model = new PrintModel();
        model.SetScale(80);
        model.SetAngle(270);
        model.SetMaterial("PETG");
        return model;
    }

    const string Start = "scale 80, angle 270, material PETG";

    [Check("each-tweak-applies-and-takes-itself-back")]
    static void EachTweakAppliesAndTakesItselfBack()
    {
        var model = Tweaked();

        void Try(Tweak tweak, string made, string afterApply)
        {
            tweak.Apply();
            var applied = Looks(model);
            Expect.That(applied == afterApply, "wrongApply", new { tweak = made, expected = afterApply, actual = applied });
            tweak.Revert();
            var reverted = Looks(model);
            Expect.That(reverted == Start, "wrongRevert", new { tweak = made, expected = Start, actual = reverted });
        }

        Try(new ScaleBy(model, 20), "ScaleBy(model, 20)", "scale 100, angle 270, material PETG");
        Try(new ScaleBy(model, -15), "ScaleBy(model, -15)", "scale 65, angle 270, material PETG");
        Try(new RotateRight(model), "RotateRight(model)", "scale 80, angle 0, material PETG");
        Try(new UseMaterial(model, "resin"), "UseMaterial(model, \"resin\")", "scale 80, angle 270, material resin");
    }

    [Check("each-tweak-has-its-name")]
    static void EachTweakHasItsName()
    {
        var model = new PrintModel();
        (Tweak tweak, string expected)[] cases =
        [
            (new ScaleBy(model, 20), "scale +20"),
            (new ScaleBy(model, -10), "scale -10"),
            (new RotateRight(model), "rotate right"),
            (new UseMaterial(model, "resin"), "material resin"),
        ];
        foreach (var (tweak, expected) in cases)
            Expect.That(tweak.Name == expected, "wrongName", new { expected, actual = tweak.Name });
    }

    [Check("step-back-takes-back-the-last-one-first")]
    static void StepBackTakesBackTheLastOneFirst()
    {
        var model = new PrintModel();
        var log = new EditLog();
        log.Apply(new ScaleBy(model, 30));
        log.Apply(new RotateRight(model));
        log.Apply(new UseMaterial(model, "resin"));
        log.Apply(new RotateRight(model));
        log.Apply(new UseMaterial(model, "PETG"));
        log.Apply(new ScaleBy(model, -10));
        var all = Looks(model);
        Expect.That(all == "scale 120, angle 180, material PETG", "wrongApplyAll",
            new { expected = "scale 120, angle 180, material PETG", actual = all });

        string[] expected =
        [
            "scale 130, angle 180, material PETG",
            "scale 130, angle 180, material resin",
            "scale 130, angle 90, material resin",
            "scale 130, angle 90, material PLA",
            "scale 130, angle 0, material PLA",
            "scale 100, angle 0, material PLA",
            "scale 100, angle 0, material PLA",
        ];
        for (var i = 0; i < expected.Length; i++)
        {
            log.StepBack();
            var now = Looks(model);
            Expect.That(now == expected[i], "wrongStepBack", new { steps = i + 1, expected = expected[i], actual = now });
        }
    }

    [Check("the-log-lists-what-is-applied")]
    static void TheLogListsWhatIsApplied()
    {
        var model = new PrintModel();
        var log = new EditLog();
        var empty = log.Applied();
        Expect.That(empty == "nothing", "wrongList", new { moment = "Before any tweak", expected = "nothing", actual = empty });

        log.Apply(new ScaleBy(model, 20));
        log.Apply(new RotateRight(model));
        log.Apply(new UseMaterial(model, "resin"));
        var three = log.Applied();
        Expect.That(three == "scale +20, rotate right, material resin", "wrongList",
            new { moment = "After three tweaks", expected = "scale +20, rotate right, material resin", actual = three });

        log.StepBack();
        var two = log.Applied();
        Expect.That(two == "scale +20, rotate right", "wrongList",
            new { moment = "After one step back", expected = "scale +20, rotate right", actual = two });

        log.StepBack();
        log.StepBack();
        log.StepBack();
        var none = log.Applied();
        Expect.That(none == "nothing", "wrongList", new { moment = "After stepping back past the start", expected = "nothing", actual = none });
    }

    [Check("the-log-never-touches-the-model")]
    static void TheLogNeverTouchesTheModel()
    {
        var tweak = typeof(Tweak);
        foreach (var type in new[] { typeof(ScaleBy), typeof(RotateRight), typeof(UseMaterial) })
            Expect.That(tweak.IsAssignableFrom(type), "notATweak", new { type = type.Name });

        foreach (var field in typeof(EditLog).GetFields(AnyField))
            foreach (var concrete in new[] { typeof(ScaleBy), typeof(RotateRight), typeof(UseMaterial), typeof(PrintModel) })
                Expect.That(!Involves(field.FieldType, concrete), "logHoldsConcrete", new { field = field.Name, type = concrete.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "EditLog")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "ScaleBy" or "RotateRight" or "UseMaterial" or "PrintModel");
        Expect.That(named is null, "logNamesConcrete", new { type = named?.Identifier.ValueText });
    }

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));
}
