using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class GiftBasketChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Three levels: big (fee 500, 800 g) holds wine and medium; medium (300, 400 g) holds cheese and small;
    // small (200, 150 g) holds jam and chocolate.
    static (Basket Big, Basket Medium) ThreeLevels()
    {
        var small = new Basket(200, 150);
        small.Add(new Delicacy("Jam", 650, 340));
        small.Add(new Delicacy("Chocolate", 380, 100));
        var medium = new Basket(300, 400);
        medium.Add(new Delicacy("Cheese", 1290, 500));
        medium.Add(small);
        var big = new Basket(500, 800);
        big.Add(new Delicacy("Wine", 1500, 1200));
        big.Add(medium);
        return (big, medium);
    }

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("delicacy-answers-for-itself")]
    static void DelicacyAnswersForItself()
    {
        IGift jam = new Delicacy("Jam", 650, 340);

        Expect.That(jam.Cents() == 650 && jam.Grams() == 340, "wrongDelicacy", new { cents = jam.Cents(), grams = jam.Grams() });
    }

    [Check("basket-adds-its-own-share")]
    static void BasketAddsItsOwnShare()
    {
        var basket = new Basket(250, 300);
        basket.Add(new Delicacy("Jam", 650, 340));
        basket.Add(new Delicacy("Crackers", 420, 200));
        IGift gift = basket;

        Expect.That(gift.Cents() == 1320 && gift.Grams() == 840, "wrongBasket", new { cents = gift.Cents(), grams = gift.Grams() });
    }

    [Check("baskets-inside-baskets-add-up")]
    static void BasketsInsideBasketsAddUp()
    {
        var (big, medium) = ThreeLevels();
        IGift gift = big;
        var (cents, grams) = (gift.Cents(), gift.Grams());
        medium.Add(new Delicacy("Honey", 700, 450));
        var (laterCents, laterGrams) = (gift.Cents(), gift.Grams());

        Expect.That(cents == 4820 && grams == 3490, "wrongNested", new { cents, grams });
        Expect.That(laterCents == 5520 && laterGrams == 3940, "missedLateGift", new { cents = laterCents, grams = laterGrams });
    }

    [Check("empty-basket-is-just-the-basket")]
    static void EmptyBasketIsJustTheBasket()
    {
        IGift empty = new Basket(200, 150);
        var (big, _) = ThreeLevels();
        big.Add(new Basket(100, 50));
        IGift gift = big;

        Expect.That(empty.Cents() == 200 && empty.Grams() == 150, "wrongEmpty", new { cents = empty.Cents(), grams = empty.Grams() });
        Expect.That(gift.Cents() == 4920 && gift.Grams() == 3540, "wrongWithEmpty", new { cents = gift.Cents(), grams = gift.Grams() });
    }

    [Check("courier-prices-by-weight")]
    static void CourierPricesByWeight()
    {
        var (big, medium) = ThreeLevels();
        var heavy = Courier.Shipping(big);
        var light = Courier.Shipping(medium);
        var atLimit = Courier.Shipping(new Delicacy("Olive oil", 1800, 2000));
        var overLimit = Courier.Shipping(new Delicacy("Olive oil", 1800, 2001));

        Expect.That(light == 590 && heavy == 990, "wrongBaskets", new { light, heavy });
        Expect.That(atLimit == 590 && overLimit == 990, "wrongLimit", new { atLimit, overLimit });
    }

    [Check("delicacies-and-baskets-share-one-type")]
    static void DelicaciesAndBasketsShareOneType()
    {
        Expect.That(typeof(IGift).IsAssignableFrom(typeof(Delicacy)), "delicacyNotAGift");
        Expect.That(typeof(IGift).IsAssignableFrom(typeof(Basket)), "basketNotAGift");

        var fields = typeof(Basket).GetFields(Declared);
        Expect.That(fields.Any(f => Inside(f.FieldType).Contains(typeof(IGift))), "noGiftField");
        Expect.That(!fields.SelectMany(f => Inside(f.FieldType)).Contains(typeof(Delicacy)), "basketHoldsDelicacies");

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "Basket"))
        {
            var mentions = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Any(n => n.Identifier.ValueText == "Delicacy");
            Expect.That(!mentions, "basketNamesDelicacy");
        }
    }
}
