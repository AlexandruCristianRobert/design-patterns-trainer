// 2 euros a km, 10 euros more in a rush, and never less than 8 euros.
var bakery = new CourierAccount("Rosa's Bakery",
    new AtLeast(8, new Sum(new Times(new Euros(2), new Distance()), new RushOr(new Euros(10), new Euros(0)))));

Console.WriteLine(bakery.Quote(new Delivery(3, 1, false)));
Console.WriteLine(bakery.Quote(new Delivery(12, 2, true)));
// 4 euros, and 2 euros a stop.
bakery.SetRate(new Sum(new Euros(4), new Times(new StopCount(), new Euros(2))));
Console.WriteLine(bakery.Quote(new Delivery(12, 2, true)));

public class Delivery(int km, int stops, bool rush)
{
    public int Km => km;
    public int Stops => stops;
    public bool Rush => rush;
}

// Every part of a rate works out its own price in whole euros for one delivery.
public interface Rate
{
    int Price(Delivery delivery);
}

public class Euros(int amount) : Rate
{
    public int Price(Delivery delivery) => amount;
}

public class Distance : Rate
{
    public int Price(Delivery delivery) => delivery.Km;
}

public class StopCount : Rate
{
    public int Price(Delivery delivery) => delivery.Stops;
}

public class Sum(Rate first, Rate second) : Rate
{
    public int Price(Delivery delivery) => first.Price(delivery) + second.Price(delivery);
}

public class Times(Rate first, Rate second) : Rate
{
    public int Price(Delivery delivery) => first.Price(delivery) * second.Price(delivery);
}

public class AtLeast(int euros, Rate rate) : Rate
{
    public int Price(Delivery delivery) => Math.Max(euros, rate.Price(delivery));
}

public class RushOr(Rate rush, Rate normal) : Rate
{
    public int Price(Delivery delivery) => delivery.Rush ? rush.Price(delivery) : normal.Price(delivery);
}

// A customer with the rate the office agreed with them. It only ever asks its rate for a price.
public class CourierAccount(string customer, Rate rate)
{
    public void SetRate(Rate newRate) => rate = newRate;

    public string Quote(Delivery delivery) => $"{customer}: {rate.Price(delivery)} euros";
}
