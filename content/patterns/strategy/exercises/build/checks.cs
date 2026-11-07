using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ReportCardChecks
{
    static string Show(List<string> grades) => grades.Count == 0 ? "nothing" : string.Join(", ", grades);

    [Check("percentage-scheme")]
    static void PercentageScheme()
    {
        var grades = Show(new ReportCard(new Percentage()).Grades([95, 7]));

        Expect.That(grades == "95%, 7%", "wrongPercentages", new { expected = "95%, 7%", actual = grades });
    }

    [Check("pass-fail-scheme")]
    static void PassFailScheme()
    {
        var grades = Show(new ReportCard(new PassFail(50)).Grades([80, 30]));
        var strict = Show(new ReportCard(new PassFail(90)).Grades([80]));

        Expect.That(grades == "pass, fail", "wrongPassFail", new { expected = "pass, fail", actual = grades });
        Expect.That(strict == "fail", "passMarkIgnored", new { expected = "fail", actual = strict });
    }

    [Check("scheme-can-change")]
    static void SchemeCanChange()
    {
        var card = new ReportCard(new Percentage());
        var before = Show(card.Grades([85]));

        card.Scheme = new PassFail(50);
        var after = Show(card.Grades([85]));

        Expect.That(before == "85%", "wrongBefore", new { expected = "85%", actual = before });
        Expect.That(after == "pass", "changeIgnored", new { expected = "pass", actual = after });
    }

    [Check("report-card-knows-only-the-scheme")]
    static void ReportCardKnowsOnlyTheScheme()
    {
        var schemeType = Code.Type("GradingScheme").Clr;
        var concrete = schemeType.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && schemeType.IsAssignableFrom(t) && t.DeclaringType != typeof(ReportCardChecks))
            .Select(t => t.Name).ToHashSet();

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "ReportCard"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "cardNamesScheme", new { type = named });
        }
    }
}
