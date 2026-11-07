// Calls cost 15 euros a month plus 10 cents a minute.
var calls = new Plus(new Fixed(1500), new Times(new Used("minutes"), new Fixed(10)));
// Texts cost 5 cents each.
var texts = new Times(new Used("texts"), new Fixed(5));

var months = new List<(string Name, Usage Usage)>
{
    ("March", new Usage(80, 20)),
    ("April", new Usage(160, 70)),
};

foreach (var (name, usage) in months)
    Console.WriteLine($"{name}: calls {calls.Price(usage)} cents, texts {texts.Price(usage)} cents");

// What a customer used in one month. Leave as is.
public class Usage(int minutes, int texts)
{
    // How much of one thing was used: "minutes" or "texts". Anything else is 0.
    public int Of(string item) => item switch
    {
        "minutes" => minutes,
        "texts" => texts,
        _ => 0,
    };
}

// Every word of a price plan works out a price in cents for one month of usage. Leave as is.
public interface ICharge
{
    int Price(Usage usage);
}

// A fixed number of cents, whatever was used. Leave as is.
public class Fixed(int cents) : ICharge
{
    public int Price(Usage usage) => cents;
}

// Its two parts added together. It is finished: use it as the model for Times. Leave as is.
public class Plus(ICharge left, ICharge right) : ICharge
{
    public int Price(Usage usage) => left.Price(usage) + right.Price(usage);
}

// How much of one thing was used this month, read from the usage by its name.
public class Used(string item) : ICharge
{
    public int Price(Usage usage) => usage.Of(item);
}

// Its two parts multiplied.
public class Times(ICharge left, ICharge right) : ICharge
{
    public int Price(Usage usage) => left.Price(usage) * right.Price(usage);
}
