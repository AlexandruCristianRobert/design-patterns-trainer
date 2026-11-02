using System.Reflection;
using DesignPatterns.Checks;

static class ExchangeKioskChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly (string Code, string Name, int Decimals)[] AllCurrencies = [("EUR", "euro", 2), ("GBP", "pound sterling", 2), ("JPY", "yen", 0)];

    // Every instance field of `type` and of its base classes.
    static IEnumerable<FieldInfo> Fields(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var f in t.GetFields(Declared)) yield return f;
    }

    // A field's name as the learner wrote it: "Code" for the field behind the Code property.
    static string Shown(FieldInfo f) => f.Name.StartsWith('<') ? f.Name[1..f.Name.IndexOf('>')] : f.Name;

    // The first field that could still be assigned after the object is made. The compiler's fields for captured
    // primary-constructor parameters are skipped; the "unchanged by use" part catches a class that assigns one.
    static FieldInfo? Writable(Type type) => Fields(type).FirstOrDefault(f => !f.IsInitOnly && !f.Name.EndsWith(">P"));

    static object?[] Snapshot(object o) => Fields(o.GetType()).Select(f => f.GetValue(o)).ToArray();

    [Check("same-code-same-currency")]
    static void SameCodeSameCurrency()
    {
        var currencies = new Currencies();
        var first = currencies.Of("EUR");
        var second = currencies.Of("EUR");

        Expect.That(ReferenceEquals(first, second), "notShared");
        Expect.That(currencies.Created == 1, "createdTwice", new { actual = currencies.Created });
    }

    [Check("each-code-its-own-currency")]
    static void EachCodeItsOwnCurrency()
    {
        var currencies = new Currencies();
        Expect.That(currencies.Created == 0, "createdTooSoon", new { actual = currencies.Created });
        var got = AllCurrencies.Select(c => currencies.Of(c.Code)).ToArray();

        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = AllCurrencies[i].Code, second = AllCurrencies[j].Code });
        for (var i = 0; i < got.Length; i++)
            Expect.That(got[i].Code == AllCurrencies[i].Code && got[i].Name == AllCurrencies[i].Name && got[i].Decimals == AllCurrencies[i].Decimals, "wrongCurrency",
                new { code = AllCurrencies[i].Code, actual = $"{got[i].Code}, {got[i].Name}, {got[i].Decimals}", expected = $"{AllCurrencies[i].Code}, {AllCurrencies[i].Name}, {AllCurrencies[i].Decimals}" });
        Expect.That(currencies.Created == 3, "wrongCreated", new { actual = currencies.Created });

        var other = new Currencies();
        Expect.That(!ReferenceEquals(other.Of("EUR"), got[0]), "sharedBetweenKiosks");
        Expect.That(other.Created == 1, "otherCreated", new { actual = other.Created });
    }

    [Check("till-shows-each-amount")]
    static void TillShowsEachAmount()
    {
        var till = new Till(new Currencies());
        till.Take(1250, "EUR");
        till.Take(1200, "JPY");
        till.Take(305, "GBP");
        till.Take(7, "EUR");

        string[] expected = ["12.50 EUR", "1200 JPY", "3.05 GBP", "0.07 EUR"];
        for (var i = 0; i < expected.Length; i++)
        {
            var actual = till.Show(i);
            Expect.That(actual == expected[i], "wrongShow", new { index = i, actual, expected = expected[i] });
        }
    }

    [Check("till-shares-the-currencies")]
    static void TillSharesTheCurrencies()
    {
        var currencies = new Currencies();
        var till = new Till(currencies);
        for (var i = 0; i < 50; i++)
            till.Take(100 + i, i % 2 == 0 ? "EUR" : "GBP");
        var created = currencies.Created;

        Expect.That(created == 2, "tillCreatedCurrencies", new { actual = created });
        for (var i = 0; i < 50; i++)
        {
            var code = i % 2 == 0 ? "EUR" : "GBP";
            Expect.That(ReferenceEquals(till.CurrencyAt(i), currencies.Of(code)), "notFromCurrencies", new { index = i, code });
        }
    }

    [Check("currency-never-changes")]
    static void CurrencyNeverChanges()
    {
        var writable = Writable(typeof(Currency));
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var currencies = new Currencies();
        var yen = currencies.Of("JPY");
        var before = Snapshot(yen);
        var till = new Till(currencies);
        till.Take(500, "JPY");
        till.Take(98000, "JPY");
        till.Show(0);
        till.Show(1);
        Expect.That(before.SequenceEqual(Snapshot(yen)), "changedByUse");
    }
}
