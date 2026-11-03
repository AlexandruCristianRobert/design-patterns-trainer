using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PostOfficeChecks
{
    static string Lines(Posting letter, string to, int grams) => string.Join(" | ", letter.Send(to, grams));

    static readonly (string Name, Func<Posting> Make, int Light, int Heavy, string Paperwork)[] Kinds =
    [
        ("StandardLetter", () => new StandardLetter(), 85, 160, ""),
        ("RegisteredLetter", () => new RegisteredLetter(), 385, 460, "stick on a tracking label | "),
        ("AbroadLetter", () => new AbroadLetter(), 180, 350, "fill in a customs form | "),
    ];

    [Check("each-letter-is-sent-in-order")]
    static void EachLetterIsSentInOrder()
    {
        foreach (var kind in Kinds)
            foreach (var (to, grams) in new[] { ("Leeds", 20), ("Oslo", 21), ("Cork", 95) })
            {
                var lines = Lines(kind.Make(), to, grams);
                var cents = grams <= 20 ? kind.Light : kind.Heavy;
                var expected = $"weigh: {grams} g | stamp: {cents} cents | {kind.Paperwork}sort into the bag for {to} | hand over the receipt";
                Expect.That(lines == expected, "wrongLines", new { letter = kind.Name, to, grams, expected, actual = lines });
            }
    }

    [Check("no-paperwork-by-default")]
    static void NoPaperworkByDefault()
    {
        var paperwork = typeof(Posting).GetMethods(Declared).FirstOrDefault(m => m.Name is "Paperwork" or "get_Paperwork");
        if (paperwork is null) Expect.Fail("noPaperwork");
        Expect.That(paperwork.IsVirtual && !paperwork.IsAbstract && !paperwork.IsFinal, "paperworkNotOptional");
        foreach (var kind in new[] { typeof(RegisteredLetter), typeof(AbroadLetter) })
            Expect.That(Overrides(kind, typeof(Posting), "Paperwork"), "paperworkNotOverridden", new { type = kind.Name });

        var lines = new StandardLetter().Send("York", 10);
        Expect.That(lines.Count == 4, "defaultNotKept", new { expected = 4, actual = lines.Count, lines = string.Join(" | ", lines) });
    }

    [Check("the-order-is-written-once")]
    static void TheOrderIsWrittenOnce()
    {
        var owner = typeof(Posting);
        var send = owner.GetMethod("Send", Declared, [typeof(string), typeof(int)]);
        if (send is null) Expect.Fail("noSend");
        Expect.That(!send.IsVirtual || send.IsFinal, "sendOverridable");

        foreach (var kind in new[] { typeof(StandardLetter), typeof(RegisteredLetter), typeof(AbroadLetter) })
        {
            Expect.That(kind != owner && owner.IsAssignableFrom(kind), "notAPosting", new { type = kind.Name });
            for (var t = kind; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Declared).Any(m => m.Name == "Send"), "sendRedeclared", new { type = t.Name });
            Expect.That(Overrides(kind, owner, "Postage"), "postageNotOverridden", new { type = kind.Name });
        }

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "Posting")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "StandardLetter" or "RegisteredLetter" or "AbroadLetter");
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
