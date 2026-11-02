var currencies = new Currencies();
var till = new Till(currencies);
till.Take(1250, "EUR");
till.Take(1200, "JPY");
till.Take(305, "GBP");
till.Take(990, "EUR");

for (var i = 0; i < 4; i++)
    Console.WriteLine(till.Show(i));
Console.WriteLine($"Currencies created: {currencies.Created}");

// Everything about one currency that every amount in it has in common. It never changes once created.
public sealed class Currency(string code, string name, int decimals)
{
    public string Code { get; } = code;
    public string Name { get; } = name;
    public int Decimals { get; } = decimals;

    public string Show(int amount) =>
        Decimals == 0 ? $"{amount} {Code}" : $"{amount / 100}.{amount % 100:00} {Code}";
}

// Hands out one Currency per code, and creates it only the first time that code is asked for.
public class Currencies
{
    private readonly Dictionary<string, Currency> made = new();

    public int Created => made.Count;

    public Currency Of(string code)
    {
        if (made.TryGetValue(code, out var currency)) return currency;
        currency = code switch
        {
            "EUR" => new Currency("EUR", "euro", 2),
            "GBP" => new Currency("GBP", "pound sterling", 2),
            "JPY" => new Currency("JPY", "yen", 0),
            _ => throw new ArgumentException($"Unknown currency {code}."),
        };
        made[code] = currency;
        return currency;
    }
}

// The till keeps, for each amount taken, only the number and a reference to the currency.
public class Till(Currencies currencies)
{
    private readonly List<(int Amount, Currency Currency)> taken = [];

    public void Take(int amount, string code) => taken.Add((amount, currencies.Of(code)));

    public Currency CurrencyAt(int index) => taken[index].Currency;

    public string Show(int index) => taken[index].Currency.Show(taken[index].Amount);
}
