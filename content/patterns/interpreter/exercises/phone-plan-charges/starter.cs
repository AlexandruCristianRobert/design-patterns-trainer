// Calls cost 15 euros a month and 10 cents a minute above 100 minutes, but never more than 40 euros.
var calls = new Smaller(
    new Plus(new Fixed(1500), new Times(new Over(100, new Used("minutes")), new Fixed(10))),
    new Fixed(4000));
// Texts cost 5 cents each above 50 texts.
var texts = new Times(new Over(50, new Used("texts")), new Fixed(5));

var months = new List<(string Name, Usage Usage)>
{
    ("March", new Usage(80, 20, 3)),
    ("April", new Usage(160, 70, 5)),
    ("May", new Usage(400, 10, 2)),
};

foreach (var (name, usage) in months)
    Console.WriteLine($"{name}: calls {calls.Price(usage)} cents, texts {texts.Price(usage)} cents");

// What a customer used in one month. Leave as is.
public class Usage(int minutes, int texts, int gigabytes)
{
    // How much of one thing was used: "minutes", "texts" or "gigabytes". Anything else is 0.
    public int Of(string item) => item switch
    {
        "minutes" => minutes,
        "texts" => texts,
        "gigabytes" => gigabytes,
        _ => 0,
    };
}

// Every part of a price plan works out a price in cents for one month of usage. Leave as is.
public interface ICharge
{
    int Price(Usage usage);
}

// A fixed number of cents, whatever was used. Leave as is.
public class Fixed(int cents) : ICharge
{
    public int Price(Usage usage) => cents;
}

// How much of one thing was used, read from the usage by its name. Leave as is.
public class Used(string item) : ICharge
{
    public int Price(Usage usage) => usage.Of(item);
}

// Its two parts added together. It is finished: use it as the model for the others. Leave as is.
public class Plus(ICharge left, ICharge right) : ICharge
{
    public int Price(Usage usage) => left.Price(usage) + right.Price(usage);
}

// Its two parts multiplied.
public class Times(ICharge left, ICharge right) : ICharge
{
    public int Price(Usage usage)
    {
        // TODO: work out both parts for this usage, and multiply them.
        return 0;
    }
}

// Only what its part comes to above the allowance, or 0 when it is not above it.
public class Over(int allowance, ICharge charge) : ICharge
{
    public int Price(Usage usage)
    {
        // TODO: work out the part for this usage. Return how far it is above the allowance, and never less than 0.
        return 0;
    }
}

// The smaller of its two parts.
public class Smaller(ICharge left, ICharge right) : ICharge
{
    public int Price(Usage usage)
    {
        // TODO: work out both parts for this usage, and return the smaller one.
        return 0;
    }
}
