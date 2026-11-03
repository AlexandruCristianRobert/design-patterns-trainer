using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ShopWindowChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // True when `type` or one of its base classes keeps an instance field of type `held`.
    static bool Keeps(Type type, Type held)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            if (t.GetFields(Declared).Any(f => f.FieldType == held)) return true;
        return false;
    }

    // No class that is `top` or derives from it names one of the program's classes that implement or derive from `held`.
    static void NamesNoDisplayClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesDisplay", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    [Check("displays-show-text-their-own-way")]
    static void DisplaysShowTextTheirOwnWay()
    {
        var led = $"{new LedStrip().Headline("50% off")} / {new LedStrip().Small("while stocks last")}";
        var paper = $"{new EPaper().Headline("50% off")} / {new EPaper().Small("while stocks last")}";

        Expect.That(led == ">> 50% OFF << / > while stocks last", "wrongLed", new { expected = ">> 50% OFF << / > while stocks last", actual = led });
        Expect.That(paper == "[50% off] / (while stocks last)", "wrongPaper", new { expected = "[50% off] / (while stocks last)", actual = paper });
    }

    [Check("sale-on-both-displays")]
    static void SaleOnBothDisplays()
    {
        var led = string.Join(" | ", new Sale(new LedStrip(), 30).Show());
        var paper = string.Join(" | ", new Sale(new EPaper(), 30).Show());

        Expect.That(led == ">> 30% OFF << | > while stocks last", "wrongSale", new { display = "LED strip", actual = led, expected = ">> 30% OFF << | > while stocks last" });
        Expect.That(paper == "[30% off] | (while stocks last)", "wrongSale", new { display = "e-paper", actual = paper, expected = "[30% off] | (while stocks last)" });
    }

    [Check("countdown-counts-the-days")]
    static void CountdownCountsTheDays()
    {
        var paper = string.Join(" | ", new Countdown(new EPaper(), 5).Show());
        var led = string.Join(" | ", new Countdown(new LedStrip(), 1).Show());

        Expect.That(paper == "[Opening soon] | (5 days to go)", "wrongCountdown", new { display = "e-paper", days = 5, actual = paper, expected = "[Opening soon] | (5 days to go)" });
        Expect.That(led == ">> OPENING SOON << | > 1 day to go", "wrongCountdown", new { display = "LED strip", days = 1, actual = led, expected = ">> OPENING SOON << | > 1 day to go" });
    }

    [Check("offers-hold-a-display")]
    static void OffersHoldADisplay()
    {
        var display = typeof(Display);
        Expect.That(display.IsInterface || display.IsAbstract, "displayNotAbstract");
        foreach (var offer in new[] { typeof(Sale), typeof(Countdown) })
        {
            Expect.That(typeof(Promotion).IsAssignableFrom(offer), "notAPromotion", new { type = offer.Name });
            Expect.That(Keeps(offer, display), "holdsNoDisplay", new { type = offer.Name });
        }
        NamesNoDisplayClass(typeof(Promotion), display);
    }
}
