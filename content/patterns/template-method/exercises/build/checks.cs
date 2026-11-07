using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BeehiveChecks
{
    static readonly (string Name, Func<HiveInspection> Make, string Open, string Comb, string Feed)[] Hives =
    [
        ("LangstrothHive", () => new LangstrothHive(), "lift the lid", "check 10 frames", ""),
        ("TopBarHive", () => new TopBarHive(), "lift the roof", "check the bars one by one", "top up the sugar syrup | "),
        ("WarreHive", () => new WarreHive(), "lift the quilt box", "check the lowest box only", ""),
    ];

    [Check("each-hive-is-inspected-in-order")]
    static void EachHiveIsInspectedInOrder()
    {
        foreach (var hive in Hives)
        {
            var lines = string.Join(" | ", hive.Make().Inspect());
            var expected =
                $"smoke the entrance | {hive.Open} | {hive.Comb} | look for the queen and her eggs | {hive.Feed}close the hive and write the notes";
            Expect.That(lines == expected, "wrongLines", new { hive = hive.Name, expected, actual = lines });
        }
    }

    [Check("only-the-top-bar-hive-is-fed")]
    static void OnlyTheTopBarHiveIsFed()
    {
        var feed = typeof(HiveInspection).GetMethods(Declared).FirstOrDefault(m => m.Name is "Feed" or "get_Feed");
        if (feed is null) Expect.Fail("noFeed");
        Expect.That(feed.IsVirtual && !feed.IsAbstract && !feed.IsFinal, "feedNotOptional");
        Expect.That(Overrides(typeof(TopBarHive), typeof(HiveInspection), "Feed"), "topBarNotFed");

        foreach (var hive in Hives.Where(h => h.Feed == ""))
        {
            var lines = hive.Make().Inspect();
            Expect.That(lines.Count == 5, "defaultNotKept",
                new { hive = hive.Name, expected = 5, actual = lines.Count, lines = string.Join(" | ", lines) });
        }
    }

    [Check("the-order-is-written-once")]
    static void TheOrderIsWrittenOnce()
    {
        var owner = typeof(HiveInspection);
        var inspect = owner.GetMethod("Inspect", Declared, Type.EmptyTypes);
        if (inspect is null) Expect.Fail("noInspect");
        Expect.That(!inspect.IsVirtual || inspect.IsFinal, "inspectOverridable");

        foreach (var kind in new[] { typeof(LangstrothHive), typeof(TopBarHive), typeof(WarreHive) })
        {
            Expect.That(kind != owner && owner.IsAssignableFrom(kind), "notAnInspection", new { type = kind.Name });
            for (var t = kind; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Declared).Any(m => m.Name == "Inspect"), "inspectRedeclared", new { type = t.Name });
            foreach (var step in new[] { "OpenUp", "CheckComb" })
                Expect.That(Overrides(kind, owner, step), "stepNotOverridden", new { type = kind.Name, step });
        }

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "HiveInspection")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "LangstrothHive" or "TopBarHive" or "WarreHive");
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
