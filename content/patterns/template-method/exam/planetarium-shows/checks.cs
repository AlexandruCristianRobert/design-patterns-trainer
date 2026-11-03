using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PlanetariumChecks
{
    static string Lines(DomeShow show, string programme) => string.Join(" | ", show.Run(programme));

    const string ShortTalk = "give a 5-minute welcome talk";

    static readonly (string Name, Func<DomeShow> Make, string Welcome, string Lights, int Volume)[] Kinds =
    [
        ("EveningShow", () => new EveningShow(), ShortTalk, "turn the dome lights off", 80),
        ("SchoolShow", () => new SchoolShow(), "give a welcome talk with a question round", "turn the dome lights off", 60),
        ("RelaxedShow", () => new RelaxedShow(), ShortTalk, "dim the dome lights, but keep them on", 40),
    ];

    [Check("each-show-runs-in-order")]
    static void EachShowRunsInOrder()
    {
        foreach (var kind in Kinds)
            foreach (var programme in new[] { "The Moons of Jupiter", "Life of a Star" })
            {
                var lines = Lines(kind.Make(), programme);
                var expected = $"open the doors | {kind.Welcome} | {kind.Lights} | set the sound to {kind.Volume} % | play {programme} | bring the lights up";
                Expect.That(lines == expected, "wrongLines", new { show = kind.Name, programme, expected, actual = lines });
            }
    }

    [Check("the-short-talk-is-the-default")]
    static void TheShortTalkIsTheDefault()
    {
        var welcome = typeof(DomeShow).GetMethods(Declared).FirstOrDefault(m => m.Name is "Welcome" or "get_Welcome");
        if (welcome is null) Expect.Fail("noWelcome");
        Expect.That(welcome.IsVirtual && !welcome.IsAbstract && !welcome.IsFinal, "welcomeNotOptional");
        Expect.That(Overrides(typeof(SchoolShow), typeof(DomeShow), "Welcome"), "schoolWelcomeNotOverridden");

        foreach (var kind in Kinds.Where(k => k.Welcome == ShortTalk))
        {
            var lines = kind.Make().Run("Northern Lights");
            var second = lines.Count > 1 ? lines[1] : "(no line)";
            Expect.That(second == ShortTalk, "defaultNotKept", new { show = kind.Name, expected = ShortTalk, actual = second });
        }
    }

    [Check("the-order-is-written-once")]
    static void TheOrderIsWrittenOnce()
    {
        var owner = typeof(DomeShow);
        var run = owner.GetMethod("Run", Declared, [typeof(string)]);
        if (run is null) Expect.Fail("noRun");
        Expect.That(!run.IsVirtual || run.IsFinal, "runOverridable");

        foreach (var kind in new[] { typeof(EveningShow), typeof(SchoolShow), typeof(RelaxedShow) })
        {
            Expect.That(kind != owner && owner.IsAssignableFrom(kind), "notADomeShow", new { type = kind.Name });
            for (var t = kind; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Declared).Any(m => m.Name == "Run"), "runRedeclared", new { type = t.Name });
            foreach (var step in new[] { "Lights", "Volume" })
                Expect.That(Overrides(kind, owner, step), "stepNotOverridden", new { type = kind.Name, step });
        }

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "DomeShow")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "EveningShow" or "SchoolShow" or "RelaxedShow");
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
