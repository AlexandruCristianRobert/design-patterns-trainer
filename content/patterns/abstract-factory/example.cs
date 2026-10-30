var continental = new BreakfastCounter(new ContinentalKitchen());
Console.WriteLine($"Continental: {continental.Serve()}");

var english = new BreakfastCounter(new EnglishKitchen());
Console.WriteLine($"English: {english.Serve()}");

public interface IDrink
{
    string Name { get; }
}

public interface IMain
{
    string Name { get; }
}

public class Coffee : IDrink
{
    public string Name => "coffee";
}

public class Tea : IDrink
{
    public string Name => "tea";
}

public class Croissant : IMain
{
    public string Name => "croissant";
}

public class FryUp : IMain
{
    public string Name => "fry-up";
}

// One object that makes a whole family of matching products.
public interface IBreakfastKitchen
{
    IDrink MakeDrink();
    IMain MakeMain();
}

public class ContinentalKitchen : IBreakfastKitchen
{
    public IDrink MakeDrink() => new Coffee();
    public IMain MakeMain() => new Croissant();
}

public class EnglishKitchen : IBreakfastKitchen
{
    public IDrink MakeDrink() => new Tea();
    public IMain MakeMain() => new FryUp();
}

// The client holds one kitchen and never names a concrete product.
public class BreakfastCounter
{
    private readonly IBreakfastKitchen kitchen;

    public BreakfastCounter(IBreakfastKitchen kitchen) => this.kitchen = kitchen;

    public string Serve()
    {
        var drink = kitchen.MakeDrink();
        var main = kitchen.MakeMain();
        return $"{drink.Name} with {main.Name}";
    }
}
