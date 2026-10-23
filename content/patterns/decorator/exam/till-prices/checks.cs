using System.Reflection;
using DesignPatterns.Checks;

static class TillPriceChecks
{
    // A price list the program has never seen: every item costs the same. Records what it was asked for.
    sealed class TestPrices(int price) : IPriceList
    {
        public List<string> Asked { get; } = [];

        public int PriceOf(string item)
        {
            Asked.Add(item);
            return price;
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

    static ShelfPrices Shelf() => new(new() { ["milk"] = 129, ["bread"] = 250 });

    static string Asked(TestPrices prices) => prices.Asked.Count == 0 ? "nothing" : string.Join(", ", prices.Asked);

    [Check("shelf-prices")]
    static void ShelfPricesAreKept()
    {
        var shelf = Shelf();
        var milk = shelf.PriceOf("milk");
        var bread = shelf.PriceOf("bread");

        Expect.That(milk == 129 && bread == 250, "wrongShelf", new { milk, bread });
    }

    [Check("tax-added")]
    static void TaxAdded()
    {
        var inside = new TestPrices(129);
        var taxed = new WithTax(inside, 19).PriceOf("milk");
        var city = new WithTax(new TestPrices(250), 10).PriceOf("bread");

        Expect.That(taxed == 153, "wrongTax", new { price = 129, percent = 19, actual = taxed, expected = 153 });
        Expect.That(city == 275, "wrongTax", new { price = 250, percent = 10, actual = city, expected = 275 });
        Expect.That(Asked(inside) == "milk", "askedWrongly", new { asked = Asked(inside) });
    }

    [Check("discount-taken-off")]
    static void DiscountTakenOff()
    {
        var inside = new TestPrices(129);
        var member = new MemberDiscount(inside, 15).PriceOf("milk");
        var bread = new MemberDiscount(new TestPrices(250), 10).PriceOf("bread");

        Expect.That(member == 109, "wrongDiscount", new { price = 129, percent = 15, actual = member, expected = 109 });
        Expect.That(bread == 225, "wrongDiscount", new { price = 250, percent = 10, actual = bread, expected = 225 });
        Expect.That(Asked(inside) == "milk", "askedWrongly", new { asked = Asked(inside) });
    }

    [Check("rounded-to-five-cents")]
    static void RoundedToFiveCents()
    {
        int[] prices = [120, 121, 122, 123, 124, 125, 0];
        var rounded = string.Join(", ", prices.Select(p => new RoundToFive(new TestPrices(p)).PriceOf("milk")));
        var inside = new TestPrices(123);
        new RoundToFive(inside).PriceOf("bread");

        Expect.That(rounded == "120, 120, 120, 125, 125, 125, 0", "wrongRounding", new { actual = rounded });
        Expect.That(Asked(inside) == "bread", "askedWrongly", new { asked = Asked(inside) });
    }

    [Check("conversions-combine-in-any-order")]
    static void ConversionsCombineInAnyOrder()
    {
        var border = new RoundToFive(new MemberDiscount(new WithTax(Shelf(), 19), 10)).PriceOf("milk");
        var city = new WithTax(new MemberDiscount(Shelf(), 10), 19).PriceOf("milk");
        var twoTaxes = new WithTax(new WithTax(Shelf(), 10), 5).PriceOf("milk");

        Expect.That(border == 135, "wrongBorder", new { actual = border });
        Expect.That(city == 138, "wrongCity", new { actual = city });
        Expect.That(twoTaxes == 148, "wrongTwoTaxes", new { actual = twoTaxes });
    }

    [Check("conversions-take-any-price-list")]
    static void ConversionsTakeAnyPriceList()
    {
        var list = typeof(IPriceList);
        foreach (var type in new[] { typeof(WithTax), typeof(MemberDiscount), typeof(RoundToFive) })
        {
            Expect.That(list.IsAssignableFrom(type), "notAPriceList", new { type = type.Name });
            Expect.That(!typeof(ShelfPrices).IsAssignableFrom(type), "extendsShelf", new { type = type.Name });

            var fields = Fields(type);
            Expect.That(fields.Any(f => f.FieldType == list), "holdsNoPriceList", new { type = type.Name });

            var concrete = fields.FirstOrDefault(f => f.FieldType != list && list.IsAssignableFrom(f.FieldType));
            Expect.That(concrete is null, "holdsConcretePriceList", new { type = type.Name, held = concrete?.FieldType.Name });
        }
    }
}
