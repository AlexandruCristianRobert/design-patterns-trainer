using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class CardChecks
{
    // A copy made by the card's own Clone(), found on ICard by reflection because the starter has none yet.
    static ICard CloneOf(ICard card)
    {
        var clone = typeof(ICard).GetMethod("Clone", Type.EmptyTypes);
        if (clone is null || clone.ReturnType != typeof(ICard)) Expect.Fail("noCloneOnCard");
        try
        {
            return (ICard)clone.Invoke(card, null)!;
        }
        catch (TargetInvocationException e)
        {
            Expect.Fail("cloneThrew", new { type = card.GetType().Name, message = e.InnerException?.Message });
            throw;
        }
    }

    // One card of each kind, already written and with a coloured envelope.
    static ICard[] Samples()
    {
        var birthday = new BirthdayCard(7);
        birthday.Lines.Add("Seven today!");
        birthday.Envelope.Colour = "blue";

        var thanks = new ThankYouCard("Coach Ilie");
        thanks.Lines.Add("Thanks for a great season.");
        thanks.Envelope.Colour = "silver";

        return [birthday, thanks];
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Birthday card (30), white envelope: Happy birthday! / Thirty looks good on you.",
            "Birthday card (30), gold envelope: Happy birthday! / Thirty looks good on you. / Love, Sam",
            "Thank-you card for the Popescus, cream envelope: Thank you for the flowers.",
            "Thank-you card for the Popescus, green envelope: Thank you for the flowers.",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("cards-copy-themselves")]
    static void CardsCopyThemselves()
    {
        var clone = typeof(ICard).GetMethod("Clone", Type.EmptyTypes);
        if (clone is null || clone.ReturnType != typeof(ICard)) Expect.Fail("noCloneOnCard");

        foreach (var card in Samples())
        {
            var type = card.GetType().Name;
            var copy = CloneOf(card);
            Expect.That(copy is not null && !ReferenceEquals(copy, card), "sameObject", new { type });
            Expect.That(copy!.GetType() == card.GetType(), "wrongKind", new { type, actual = copy.GetType().Name });
            Expect.That(copy.Describe() == card.Describe(), "differentCopy", new { type, expected = card.Describe(), actual = copy.Describe() });
        }
    }

    [Check("copies-are-independent")]
    static void CopiesAreIndependent()
    {
        var clone = typeof(ICard).GetMethod("Clone", Type.EmptyTypes);
        if (clone is null || clone.ReturnType != typeof(ICard)) Expect.Fail("noCloneOnCard");

        foreach (var card in Samples())
        {
            var type = card.GetType().Name;
            var before = card.Describe();
            var copy = CloneOf(card);

            copy.Lines.Add("P.S. Call me!");
            Expect.That(card.Describe() == before, "sharedLines", new { type, actual = card.Describe() });

            copy.Envelope.Colour = "red";
            Expect.That(card.Describe() == before, "sharedEnvelope", new { type, actual = card.Describe() });
        }
    }

    [Check("copying-leaves-the-original-alone")]
    static void CopyingLeavesTheOriginalAlone()
    {
        foreach (var card in Samples())
        {
            var type = card.GetType().Name;
            var before = card.Describe();
            var copy = new CardShop().Copy(card);

            Expect.That(card.Describe() == before, "originalChanged", new { type, actual = card.Describe() });
            Expect.That(copy is not null && !ReferenceEquals(copy, card), "shopSameObject", new { type });
            Expect.That(copy!.GetType() == card.GetType(), "shopWrongKind", new { type, actual = copy.GetType().Name });
        }
    }

    [Check("shop-names-no-card-class")]
    static void ShopNamesNoCardClass()
    {
        var clone = typeof(ICard).GetMethod("Clone", Type.EmptyTypes);
        if (clone is null || clone.ReturnType != typeof(ICard)) Expect.Fail("noCloneOnCard");

        var classes = typeof(ICard).Assembly.GetTypes()
            .Where(t => t.IsClass && typeof(ICard).IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "CardShop"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "shopNamesCardClass", new { type = named });
        }
    }
}
