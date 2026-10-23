using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class LabLabelChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // No constructor of `owner` takes parameters, so nothing can be handed in from outside for it to use.
    static void NoConstructorParameters(Type owner)
    {
        var ctor = owner.GetConstructors(Instance).FirstOrDefault(c => c.GetParameters().Length > 0);
        Expect.That(ctor is null, "ownerTakesParameters", new { owner = owner.Name, parameters = ctor is null ? "" : string.Join(", ", ctor.GetParameters().Select(p => p.ParameterType.Name)) });
    }

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
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(LabLabelChecks))
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
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        var instance = ctor.Invoke(null);
        var first = making.Invoke(instance, null);
        var second = making.Invoke(instance, null);
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type = type.Name, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = making.Name });
    }

    [Check("labels-print-their-format")]
    static void LabelsPrintTheirFormat()
    {
        ILabel barcode = new BarcodeLabel();
        ILabel qr = new QrLabel();
        var barcodeText = barcode.Print("A-17", 4);
        var qrText = qr.Print("river", 12);

        Expect.That(barcodeText == "||| 004 A-17" && barcode.Width == 30, "wrongBarcode", new { actual = barcodeText, width = barcode.Width });
        Expect.That(qrText == "[QR] river #12" && qr.Width == 20, "wrongQr", new { actual = qrText, width = qr.Width });
    }

    [Check("blood-run-uses-barcodes")]
    static void BloodRunUsesBarcodes()
    {
        var lines = string.Join(" / ", new BloodRun().Process(["A-17", "B-02"]));

        Expect.That(lines == "||| 001 A-17 / ||| 002 B-02 / roll used: 60 mm", "wrongBloodRun", new { actual = lines });
    }

    [Check("water-run-uses-qr-codes")]
    static void WaterRunUsesQrCodes()
    {
        var lines = string.Join(" / ", new WaterRun().Process(["river", "well", "tap"]));

        Expect.That(lines == "[QR] river #1 / [QR] well #2 / [QR] tap #3 / roll used: 60 mm", "wrongWaterRun", new { actual = lines });
    }

    [Check("empty-run-uses-no-roll")]
    static void EmptyRunUsesNoRoll()
    {
        var lines = string.Join(" / ", new BloodRun().Process([]));

        Expect.That(lines == "roll used: 0 mm", "wrongEmptyRun", new { actual = lines });
    }

    [Check("run-knows-only-ilabel")]
    static void RunKnowsOnlyILabel()
    {
        var making = MakingMethod(typeof(SampleRun), typeof(ILabel));
        NoConstructorParameters(typeof(SampleRun));
        OperationWrittenOnce(typeof(SampleRun), "Process", typeof(BloodRun), typeof(WaterRun));
        NamesNoMadeClass("SampleRun", typeof(ILabel));
        MakesItsOwn(making, typeof(BloodRun), typeof(BarcodeLabel));
        MakesItsOwn(making, typeof(WaterRun), typeof(QrLabel));
    }
}
