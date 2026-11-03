using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class VetCheckUpChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Tiger, 4 years: weigh",
            "listen to the heart and check the teeth",
            "vaccinate against cat flu",
            "book the next check-up in a year",
            "Bella, 11 years: weigh",
            "check the hips and the teeth",
            "vaccinate against kennel cough",
            "take a blood test for older pets",
            "trim the claws",
            "book the next check-up in a year",
            "Clover, 2 years: weigh",
            "check the teeth and the ears",
            "vaccinate against myxomatosis",
            "book the next check-up in a year",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("every-kind-runs-the-steps-in-order")]
    static void EveryKindRunsTheStepsInOrder()
    {
        var run = RunOf(Code.Type("CheckUp").Clr);

        void Try(object kind, string pet, int age, string expected)
        {
            var lines = string.Join(" | ", (List<string>)run.Invoke(kind, [pet, age])!);
            Expect.That(lines == expected, "wrongLines", new { kind = kind.GetType().Name, pet, age, expected, actual = lines });
        }

        Try(new CatCheckUp(), "Misty", 12,
            "Misty, 12 years: weigh | listen to the heart and check the teeth | vaccinate against cat flu | take a blood test for older pets | book the next check-up in a year");
        Try(new DogCheckUp(), "Rex", 3,
            "Rex, 3 years: weigh | check the hips and the teeth | vaccinate against kennel cough | trim the claws | book the next check-up in a year");
        Try(new DogCheckUp(), "Max", 10,
            "Max, 10 years: weigh | check the hips and the teeth | vaccinate against kennel cough | take a blood test for older pets | trim the claws | book the next check-up in a year");
        Try(new RabbitCheckUp(), "Bun", 10,
            "Bun, 10 years: weigh | check the teeth and the ears | vaccinate against myxomatosis | take a blood test for older pets | book the next check-up in a year");
        Try(new RabbitCheckUp(), "Bun", 9,
            "Bun, 9 years: weigh | check the teeth and the ears | vaccinate against myxomatosis | book the next check-up in a year");
    }

    [Check("only-dogs-get-the-extra-step")]
    static void OnlyDogsGetTheExtraStep()
    {
        var checkUp = Code.Type("CheckUp").Clr;
        var extra = checkUp.GetMethods(Declared).FirstOrDefault(m => m.Name == "Extra");
        if (extra is null) Expect.Fail("noExtra");
        Expect.That(extra.IsVirtual && !extra.IsAbstract && !extra.IsFinal, "extraNotOptional");
        Expect.That(Overrides(typeof(DogCheckUp), checkUp, "Extra"), "dogExtraNotOverridden");

        var run = RunOf(checkUp);
        foreach (var kind in new object[] { new CatCheckUp(), new RabbitCheckUp() })
        {
            var lines = (List<string>)run.Invoke(kind, ["Pip", 5])!;
            Expect.That(lines.Count == 4, "defaultNotKept",
                new { kind = kind.GetType().Name, expected = 4, actual = lines.Count, lines = string.Join(" | ", lines) });
        }
    }

    [Check("the-order-is-written-once")]
    static void TheOrderIsWrittenOnce()
    {
        var checkUp = Code.Type("CheckUp").Clr;
        var run = RunOf(checkUp);
        Expect.That(!run.IsVirtual || run.IsFinal, "runOverridable");

        foreach (var kind in new[] { typeof(CatCheckUp), typeof(DogCheckUp), typeof(RabbitCheckUp) })
        {
            Expect.That(kind != checkUp && checkUp.IsAssignableFrom(kind), "notACheckUp", new { type = kind.Name });
            for (var t = kind; t != checkUp; t = t.BaseType!)
                Expect.That(!t.GetMethods(Declared).Any(m => m.Name == "Run"), "runRedeclared", new { type = t.Name });
            foreach (var step in new[] { "Examine", "Vaccinate" })
                Expect.That(Overrides(kind, checkUp, step), "stepNotOverridden", new { type = kind.Name, step });
        }

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "CheckUp")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "CatCheckUp" or "DogCheckUp" or "RabbitCheckUp");
        Expect.That(named is null, "namesAKind", new { type = named?.Identifier.ValueText });
    }

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // CheckUp's public List<string> Run(string pet, int age).
    static MethodInfo RunOf(Type checkUp)
    {
        var run = checkUp.GetMethod("Run", BindingFlags.Instance | BindingFlags.Public, [typeof(string), typeof(int)]);
        if (run is null || run.DeclaringType != checkUp || run.ReturnType != typeof(List<string>)) Expect.Fail("noRun");
        return run;
    }

    // `kind`, or a class between it and `owner`, overrides the method or property `step` of a class above it.
    static bool Overrides(Type kind, Type owner, string step)
    {
        for (var t = kind; t != owner && t is not null; t = t.BaseType)
            if (t.GetMethods(Declared).Any(m => (m.Name == step || m.Name == "get_" + step) && m.GetBaseDefinition().DeclaringType != t))
                return true;
        return false;
    }
}
