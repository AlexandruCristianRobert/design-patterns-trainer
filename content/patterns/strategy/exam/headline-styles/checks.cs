using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class HeadlineStyleChecks
{
    [Check("upper-style")]
    static void UpperStyle()
    {
        var result = new HeadlineDesk(HouseStyles.Upper).Format("Market opens higher");

        Expect.That(result == "MARKET OPENS HIGHER", "wrongUpper", new { actual = result });
    }

    [Check("title-case-style")]
    static void TitleCaseStyle()
    {
        var result = new HeadlineDesk(HouseStyles.TitleCase).Format("market OPENS higher");

        Expect.That(result == "Market Opens Higher", "wrongTitleCase", new { actual = result });
    }

    [Check("sentence-style")]
    static void SentenceStyle()
    {
        var result = new HeadlineDesk(HouseStyles.Sentence).Format("MARKET opens HIGHER");

        Expect.That(result == "Market opens higher", "wrongSentence", new { actual = result });
    }

    [Check("spacing-tidied-for-every-style")]
    static void SpacingTidiedForEveryStyle()
    {
        const string messy = "  market   opens  higher ";
        var upper = new HeadlineDesk(HouseStyles.Upper).Format(messy);
        var title = new HeadlineDesk(HouseStyles.TitleCase).Format(messy);
        var sentence = new HeadlineDesk(HouseStyles.Sentence).Format(messy);

        Expect.That(upper == "MARKET OPENS HIGHER", "untidyUpper", new { actual = upper });
        Expect.That(title == "Market Opens Higher", "untidyTitleCase", new { actual = title });
        Expect.That(sentence == "Market opens higher", "untidySentence", new { actual = sentence });
    }

    [Check("desks-keep-their-own-style")]
    static void DesksKeepTheirOwnStyle()
    {
        var sport = new HeadlineDesk(HouseStyles.Upper);
        var culture = new HeadlineDesk(HouseStyles.Sentence);

        var sportResult = sport.Format("late goal wins it");
        var cultureResult = culture.Format("late goal wins it");

        Expect.That(sportResult == "LATE GOAL WINS IT", "styleShared", new { actual = sportResult });
        Expect.That(cultureResult == "Late goal wins it", "wrongSentence", new { actual = cultureResult });
    }

    [Check("desk-knows-no-particular-style")]
    static void DeskKnowsNoParticularStyle()
    {
        var styleType = Code.Type("HeadlineStyle").Clr;
        Expect.That(!styleType.IsEnum, "styleIsEnum");

        var banned = styleType.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && t != styleType && styleType.IsAssignableFrom(t) &&
                t.DeclaringType != typeof(HeadlineStyleChecks))
            .Select(t => t.Name).Append("HouseStyles").Append("GetType").ToHashSet();

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "HeadlineDesk"))
        {
            var hasSwitch = declaration.DescendantNodes().Any(n => n is SwitchStatementSyntax or SwitchExpressionSyntax);
            Expect.That(!hasSwitch, "deskSwitches");

            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(banned.Contains);
            Expect.That(named is null, "deskNamesStyle", new { type = named });
        }
    }
}
