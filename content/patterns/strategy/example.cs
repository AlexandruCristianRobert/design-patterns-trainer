var checkout = new ShippingCalculator(new StandardPost());
Console.WriteLine($"Standard post: {checkout.Quote(2.5m):0.00} EUR");

checkout.Strategy = new ExpressCourier();
Console.WriteLine($"Express courier: {checkout.Quote(2.5m):0.00} EUR");

public interface IShippingStrategy
{
    decimal Cost(decimal weightKg);
}

public class ShippingCalculator(IShippingStrategy strategy)
{
    // The algorithm is held in a property, so it can be swapped while the program runs.
    public IShippingStrategy Strategy { get; set; } = strategy;

    public decimal Quote(decimal weightKg)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(weightKg);
        return Strategy.Cost(weightKg);
    }
}

public class StandardPost : IShippingStrategy
{
    public decimal Cost(decimal weightKg) => 3.00m + 0.60m * weightKg;
}

public class ExpressCourier : IShippingStrategy
{
    public decimal Cost(decimal weightKg) => 9.00m + 1.20m * weightKg;
}
