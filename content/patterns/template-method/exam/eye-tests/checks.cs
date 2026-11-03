using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class EyeTestChecks
{
    static string Lines(EyeTest test, string patient) => string.Join(" | ", test.Run(patient));

    const string Puff = "test the eye pressure with a puff of air";

    static readonly (string Name, Func<EyeTest> Make, string Chart, string Pressure, string Outcome)[] Kinds =
    [
        ("AdultEyeTest", () => new AdultEyeTest(), "letter chart", Puff + " | ", "write the glasses prescription"),
        ("ChildEyeTest", () => new ChildEyeTest(), "picture chart", "", "write a note for the parents"),
        ("DriverEyeTest", () => new DriverEyeTest(), "number plate at 20 metres", Puff + " | ", "sign the driving form"),
    ];

    [Check("each-test-runs-in-order")]
    static void EachTestRunsInOrder()
    {
        foreach (var kind in Kinds)
            foreach (var patient in new[] { "Noor", "Pavel" })
            {
                var lines = Lines(kind.Make(), patient);
                var expected = $"{patient}: ask about the eyes | read the {kind.Chart} | {kind.Pressure}look at the back of the eyes | {kind.Outcome}";
                Expect.That(lines == expected, "wrongLines", new { test = kind.Name, patient, expected, actual = lines });
            }
    }

    [Check("the-pressure-test-is-the-default")]
    static void ThePressureTestIsTheDefault()
    {
        var pressure = typeof(EyeTest).GetMethods(Declared).FirstOrDefault(m => m.Name is "PressureTest" or "get_PressureTest");
        if (pressure is null) Expect.Fail("noPressureTest");
        Expect.That(pressure.IsVirtual && !pressure.IsAbstract && !pressure.IsFinal, "pressureTestNotOptional");
        Expect.That(Overrides(typeof(ChildEyeTest), typeof(EyeTest), "PressureTest"), "childPressureNotOverridden");

        foreach (var kind in Kinds.Where(k => k.Pressure != ""))
        {
            var lines = kind.Make().Run("Ida");
            var third = lines.Count > 2 ? lines[2] : "(no line)";
            Expect.That(third == Puff, "defaultNotKept", new { test = kind.Name, expected = Puff, actual = third });
        }
    }

    [Check("the-order-is-written-once")]
    static void TheOrderIsWrittenOnce()
    {
        var owner = typeof(EyeTest);
        var run = owner.GetMethod("Run", Declared, [typeof(string)]);
        if (run is null) Expect.Fail("noRun");
        Expect.That(!run.IsVirtual || run.IsFinal, "runOverridable");

        foreach (var kind in new[] { typeof(AdultEyeTest), typeof(ChildEyeTest), typeof(DriverEyeTest) })
        {
            Expect.That(kind != owner && owner.IsAssignableFrom(kind), "notAnEyeTest", new { type = kind.Name });
            for (var t = kind; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Declared).Any(m => m.Name == "Run"), "runRedeclared", new { type = t.Name });
            foreach (var step in new[] { "Chart", "Outcome" })
                Expect.That(Overrides(kind, owner, step), "stepNotOverridden", new { type = kind.Name, step });
        }

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "EyeTest")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "AdultEyeTest" or "ChildEyeTest" or "DriverEyeTest");
        Expect.That(named is null, "namesAKind", new { type = named?.Identifier.ValueText });
    }

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // `kind`, or a class between it and `owner`, overrides the method or property `step` of a class above it.
    static bool Overrides(Type kind, Type owner, string step)
    {
        for (var t = kind; t != owner && t is not null; t = t.BaseType)
            if (t.GetMethods(Declared).Any(m => (m.Name == step || m.Name == "get_" + step) && m.GetBaseDefinition().DeclaringType != t))
                return true;
        return false;
    }
}
