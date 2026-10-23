using System.Reflection;
using DesignPatterns.Checks;

static class PhrasebookChecks
{
    // A phrasebook the program has never seen: answers <phrase> and records every phrase it was asked for.
    sealed class TestBook : IPhrasebook
    {
        public List<string> Asked { get; } = [];

        public string Translate(string phrase)
        {
            Asked.Add(phrase);
            return $"<{phrase}>";
        }
    }

    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every instance field of the type, including those declared in its base classes.
    static List<FieldInfo> Fields(Type type)
    {
        var fields = new List<FieldInfo>();
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            fields.AddRange(t.GetFields(Declared));
        return fields;
    }

    static string Asked(TestBook book) => book.Asked.Count == 0 ? "nothing" : string.Join(", ", book.Asked);

    static string TranslateAll(IPhrasebook book, params string[] phrases) => string.Join(", ", phrases.Select(book.Translate));

    [Check("offline-lookup")]
    static void OfflineLookup()
    {
        var french = new OfflinePhrasebook(new() { ["hello"] = "bonjour", ["thank you"] = "merci" });
        var answers = TranslateAll(french, "hello", "thank you", "goodbye", "Hello");

        Expect.That(answers == "bonjour, merci, ?, ?", "wrongLookup", new { actual = answers });
    }

    [Check("remembered-asks-once-per-phrase")]
    static void RememberedAsksOncePerPhrase()
    {
        var inside = new TestBook();
        var answers = TranslateAll(new Remembered(inside), "hello", "hello", "thank you", "hello");

        var other = new TestBook();
        new Remembered(other).Translate("hello");

        Expect.That(answers == "<hello>, <hello>, <thank you>, <hello>", "rememberedChangedAnswer", new { actual = answers });
        Expect.That(Asked(inside) == "hello, thank you", "askedAgain", new { asked = Asked(inside) });
        Expect.That(Asked(other) == "hello", "memoryShared", new { asked = Asked(other) });
    }

    [Check("any-case-asks-in-lower-case")]
    static void AnyCaseAsksInLowerCase()
    {
        var inside = new TestBook();
        var answer = new AnyCase(inside).Translate("Thank YOU");

        Expect.That(Asked(inside) == "thank you", "notLowerCase", new { asked = Asked(inside) });
        Expect.That(answer == "<thank you>", "anyCaseChangedAnswer", new { actual = answer });
    }

    [Check("order-decides-how-often-it-asks")]
    static void OrderDecidesHowOftenItAsks()
    {
        var caseFirst = new TestBook();
        var caseFirstAnswers = TranslateAll(new AnyCase(new Remembered(caseFirst)), "Hello", "HELLO", "hello");

        var memoryFirst = new TestBook();
        var memoryFirstAnswers = TranslateAll(new Remembered(new AnyCase(memoryFirst)), "Hello", "HELLO", "hello", "Hello");

        Expect.That(caseFirstAnswers == "<hello>, <hello>, <hello>" && Asked(caseFirst) == "hello",
            "wrongCaseFirst", new { answers = caseFirstAnswers, asked = Asked(caseFirst) });
        Expect.That(memoryFirstAnswers == "<hello>, <hello>, <hello>, <hello>" && Asked(memoryFirst) == "hello, hello, hello",
            "wrongMemoryFirst", new { answers = memoryFirstAnswers, asked = Asked(memoryFirst) });
    }

    [Check("helpers-take-any-phrasebook")]
    static void HelpersTakeAnyPhrasebook()
    {
        var book = typeof(IPhrasebook);
        foreach (var type in new[] { typeof(Remembered), typeof(AnyCase) })
        {
            Expect.That(book.IsAssignableFrom(type), "notAPhrasebook", new { type = type.Name });
            Expect.That(!typeof(OfflinePhrasebook).IsAssignableFrom(type), "extendsOffline", new { type = type.Name });

            var fields = Fields(type);
            Expect.That(fields.Any(f => f.FieldType == book), "holdsNoPhrasebook", new { type = type.Name });

            var concrete = fields.FirstOrDefault(f => f.FieldType != book && book.IsAssignableFrom(f.FieldType));
            Expect.That(concrete is null, "holdsConcretePhrasebook", new { type = type.Name, held = concrete?.FieldType.Name });
        }
    }
}
