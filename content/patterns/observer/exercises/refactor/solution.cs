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
        stock.Attach(new Alerts(limit: 103m));

        stock.SetPrice(100m);
        stock.SetPrice(104m);
        stock.SetPrice(98m);

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
    void PriceChanged(string symbol, decimal price);
}

public class Stock(string symbol)
{
    private readonly List<IStockObserver> _observers = [];

    public void Attach(IStockObserver observer) => _observers.Add(observer);

    public void Detach(IStockObserver observer) => _observers.Remove(observer);

    public void SetPrice(decimal price)
    {
        foreach (var observer in _observers.ToList())
            observer.PriceChanged(symbol, price);
    }
}

public class Logger : IStockObserver
{
    public void PriceChanged(string symbol, decimal price) => Log(symbol, price);

    public void Log(string symbol, decimal price) => Screen.Lines.Add($"log: {symbol} is now {price}");
}

public class Chart : IStockObserver
{
    private decimal? _last;

    public void PriceChanged(string symbol, decimal price) => Plot(price);

    public void Plot(decimal price)
    {
        var trend = _last is not { } last ? "start" : price > last ? "up" : price < last ? "down" : "flat";
        Screen.Lines.Add($"chart: {price} ({trend})");
        _last = price;
    }
}

public class Alerts(decimal limit) : IStockObserver
{
    public void PriceChanged(string symbol, decimal price) => Check(symbol, price);

    public void Check(string symbol, decimal price)
    {
        if (price > limit) Screen.Lines.Add($"alert: {symbol} above {limit}");
    }
}
