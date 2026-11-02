var small = new Basket(200, 150);
small.Add(new Delicacy("Plum jam", 650, 340));
small.Add(new Delicacy("Dark chocolate", 380, 100));

var hamper = new Basket(500, 800);
hamper.Add(new Delicacy("Red wine", 1500, 1200));
hamper.Add(new Delicacy("Aged cheese", 1290, 500));
hamper.Add(small);

IGift gift = hamper;
Console.WriteLine($"{gift.Cents() / 100}.{gift.Cents() % 100:D2} euros, {gift.Grams()} g, shipping {Courier.Shipping(gift)} cents");

// Anything the shop can send: one delicacy, or a basket of delicacies and baskets.
public interface IGift
{
    int Cents();
    int Grams();
}

// A delicacy answers for itself.
public class Delicacy(string name, int cents, int grams) : IGift
{
    public string Name => name;
    public int Cents() => cents;
    public int Grams() => grams;
}

// A basket holds any number of gifts, and answers with its own fee and weight plus everything inside.
public class Basket(int feeCents, int grams) : IGift
{
    private readonly List<IGift> gifts = [];

    public void Add(IGift gift) => gifts.Add(gift);

    public int Cents() => feeCents + gifts.Sum(g => g.Cents());

    public int Grams() => grams + gifts.Sum(g => g.Grams());
}

// The courier prices a parcel by weight, whatever is in it.
public static class Courier
{
    public static int Shipping(IGift gift) => gift.Grams() <= 2000 ? 590 : 990;
}
