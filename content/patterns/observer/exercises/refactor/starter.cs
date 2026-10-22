foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        var stock = new Stock("ACME");
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
    private readonly Logger _logger = new();
    private readonly Chart _chart = new();
    private readonly Alerts _alerts = new(limit: 103m);

    public void Attach(IStockObserver observer)
    {
        // TODO
    }

    public void Detach(IStockObserver observer)
    {
        // TODO
    }

    public void SetPrice(decimal price)
    {
        _logger.Log(symbol, price);
        _chart.Plot(price);
        _alerts.Check(symbol, price);
    }
}

public class Logger
{
    public void Log(string symbol, decimal price) => Screen.Lines.Add($"log: {symbol} is now {price}");
}

public class Chart
{
    private decimal? _last;

    public void Plot(decimal price)
    {
        var trend = _last is not { } last ? "start" : price > last ? "up" : price < last ? "down" : "flat";
        Screen.Lines.Add($"chart: {price} ({trend})");
        _last = price;
    }
}

public class Alerts(decimal limit)
{
    public void Check(string symbol, decimal price)
    {
        if (price > limit) Screen.Lines.Add($"alert: {symbol} above {limit}");
    }
}
