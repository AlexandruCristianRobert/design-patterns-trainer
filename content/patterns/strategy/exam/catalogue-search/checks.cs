using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class CatalogueSearchChecks
{
    static Catalogue Books() => new(["Dune", "Dune Messiah", "Emma", "dune: a guide", "The Dune Atlas"]);

    static string Show(List<string> found) => found.Count == 0 ? "nothing" : string.Join(" | ", found);

    // Hands a rule to the catalogue through whichever public settable property or one-argument method takes a TitleMatch.
    static void GiveRule(object catalogue, object rule)
    {
        var ruleType = Code.Type("TitleMatch").Clr;
        var type = catalogue.GetType();
        var property = type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(p => p.PropertyType == ruleType && p.SetMethod is { IsPublic: true });
        if (property is not null)
        {
            property.SetValue(catalogue, rule);
            return;
        }
        var method = type.GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(m => !m.IsSpecialName && m.GetParameters() is [var p] && p.ParameterType == ruleType);
        if (method is null) Expect.Fail("noWayToChoose");
        method.Invoke(catalogue, [rule]);
    }

    [Check("exact-rule")]
    static void ExactRule()
    {
        var catalogue = Books();
        GiveRule(catalogue, new ExactMatch());

        var same = catalogue.Find("Dune");
        var otherCase = catalogue.Find("dune");

        Expect.That(Show(same) == "Dune", "wrongExact", new { actual = Show(same) });
        Expect.That(otherCase.Count == 0, "exactIgnoredCase", new { actual = Show(otherCase) });
    }

    [Check("ignore-case-rule")]
    static void IgnoreCaseRule()
    {
        var catalogue = Books();
        GiveRule(catalogue, new IgnoreCaseMatch());

        var found = catalogue.Find("DUNE MESSIAH");

        Expect.That(Show(found) == "Dune Messiah", "wrongIgnoreCase", new { actual = Show(found) });
    }

    [Check("starts-with-rule")]
    static void StartsWithRule()
    {
        var catalogue = Books();
        GiveRule(catalogue, new StartsWithMatch());

        var found = catalogue.Find("dUNE");

        Expect.That(Show(found) == "Dune | Dune Messiah | dune: a guide", "wrongStartsWith", new { actual = Show(found) });
    }

    [Check("rule-can-change")]
    static void RuleCanChange()
    {
        var catalogue = Books();
        GiveRule(catalogue, new ExactMatch());
        var before = catalogue.Find("emma");

        GiveRule(catalogue, new IgnoreCaseMatch());
        var after = catalogue.Find("emma");

        Expect.That(before.Count == 0, "wrongExact", new { actual = Show(before) });
        Expect.That(Show(after) == "Emma", "changeIgnored", new { actual = Show(after) });
    }

    [Check("catalogue-knows-no-particular-rule")]
    static void CatalogueKnowsNoParticularRule()
    {
        var ruleType = Code.Type("TitleMatch").Clr;
        var concrete = ruleType.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && ruleType.IsAssignableFrom(t) && t.DeclaringType != typeof(CatalogueSearchChecks))
            .Select(t => t.Name).Append("GetType").ToHashSet();

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "Catalogue"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "catalogueNamesRule", new { type = named });
        }
    }
}
