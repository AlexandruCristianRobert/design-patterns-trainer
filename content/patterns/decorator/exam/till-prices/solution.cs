var shelf = new ShelfPrices(new() { ["milk"] = 129, ["bread"] = 250 });

// The shop near the border: tax, then the member discount, then rounding to 5 cents.
IPriceList borderTill = new RoundToFive(new MemberDiscount(new WithTax(shelf, 19), 10));
// The city shop: the discount comes off before tax, and there is no rounding.
IPriceList cityTill = new WithTax(new MemberDiscount(shelf, 10), 19);

foreach (var item in new[] { "milk", "bread" })
    Console.WriteLine($"{item}: shelf {shelf.PriceOf(item)}, border {borderTill.PriceOf(item)}, city {cityTill.PriceOf(item)} cents");

public interface IPriceList
{
    // The price in cents.
    int PriceOf(string item);
}

public class ShelfPrices(Dictionary<string, int> prices) : IPriceList
{
    public int PriceOf(string item) => prices[item];
}

public class WithTax(IPriceList prices, int percent) : IPriceList
{
    public int PriceOf(string item) => prices.PriceOf(item) * (100 + percent) / 100;
}

public class MemberDiscount(IPriceList prices, int percent) : IPriceList
{
    public int PriceOf(string item) => prices.PriceOf(item) * (100 - percent) / 100;
}

public class RoundToFive(IPriceList prices) : IPriceList
{
    public int PriceOf(string item) => (prices.PriceOf(item) + 2) / 5 * 5;
}
