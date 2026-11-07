foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        var stock = new Stock("ACME");
        stock.Attach(new Logger());
        stock.Attach(new Chart());
        stock.Attach(new Alerts());

        stock.SetPrice(100);
        stock.SetPrice(104);

        return [.. Screen.Lines];
    }
}

// Collects what the program prints, so Demo.Run() can return it. Leave as is.
public static class Screen
{
    public static List<string> Lines { get; } = [];
}

public interface IStockObserver
{
    void PriceChanged(string symbol, int price);
}

public class Stock(string symbol)
{
    private readonly List<IStockObserver> _observers = [];

    public void Attach(IStockObserver observer) => _observers.Add(observer);

    public void Detach(IStockObserver observer) => _observers.Remove(observer);

    public void SetPrice(int price)
    {
        foreach (var observer in _observers.ToList())
            observer.PriceChanged(symbol, price);
    }
}

public class Logger : IStockObserver
{
    public void PriceChanged(string symbol, int price) => Screen.Lines.Add($"log: {symbol} is now {price}");
}

public class Chart : IStockObserver
{
    public void PriceChanged(string symbol, int price) => Screen.Lines.Add($"chart: {price}");
}

public class Alerts : IStockObserver
{
    public void PriceChanged(string symbol, int price)
    {
        if (price > 103) Screen.Lines.Add($"alert: {symbol} above 103");
    }
}
