using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ReportCardChecks
{
    static string Show(List<string> grades) => grades.Count == 0 ? "nothing" : string.Join(", ", grades);

    // Hands a new scheme to the card through whichever public settable property or one-argument method takes a GradingScheme.
    static void GiveScheme(object card, object scheme)
    {
        var schemeType = Code.Type("GradingScheme").Clr;
        var type = card.GetType();
        var property = type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(p => p.PropertyType == schemeType && p.SetMethod is { IsPublic: true });
        if (property is not null)
        {
            property.SetValue(card, scheme);
            return;
        }
        var method = type.GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(m => !m.IsSpecialName && m.GetParameters() is [var p] && p.ParameterType == schemeType);
        if (method is null) Expect.Fail("noWayToChange");
        method.Invoke(card, [scheme]);
    }

    [Check("percentage-scheme")]
    static void PercentageScheme()
    {
        var grades = new ReportCard(new Percentage()).Grades([95, 7, 0, 100]);

        Expect.That(Show(grades) == "95%, 7%, 0%, 100%", "wrongPercentages", new { actual = Show(grades) });
    }

    [Check("pass-fail-scheme")]
    static void PassFailScheme()
    {
        var grades = new ReportCard(new PassFail(50)).Grades([50, 49, 100, 0]);
        var strict = new ReportCard(new PassFail(75)).Grades([74, 75]);

        Expect.That(Show(grades) == "pass, fail, pass, fail", "wrongPassFail", new { actual = Show(grades) });
        Expect.That(Show(strict) == "fail, pass", "passMarkIgnored", new { actual = Show(strict) });
    }

    [Check("letter-scheme")]
    static void LetterScheme()
    {
        var grades = new ReportCard(new Letters()).Grades([100, 90, 89, 80, 79, 70, 69, 60, 59, 0]);

        Expect.That(Show(grades) == "A, A, B, B, C, C, D, D, F, F", "wrongLetters", new { actual = Show(grades) });
    }

    [Check("scheme-can-change")]
    static void SchemeCanChange()
    {
        var card = new ReportCard(new Percentage());
        var before = card.Grades([85]);

        GiveScheme(card, new Letters());
        var after = card.Grades([85]);

        Expect.That(Show(before) == "85%", "wrongBefore", new { actual = Show(before) });
        Expect.That(Show(after) == "B", "changeIgnored", new { actual = Show(after) });
    }

    [Check("report-card-knows-only-the-scheme")]
    static void ReportCardKnowsOnlyTheScheme()
    {
        var schemeType = Code.Type("GradingScheme").Clr;
        var concrete = schemeType.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && schemeType.IsAssignableFrom(t) && t.DeclaringType != typeof(ReportCardChecks))
            .Select(t => t.Name).Append("GetType").ToHashSet();

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "ReportCard"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "cardNamesScheme", new { type = named });
        }
    }
}
