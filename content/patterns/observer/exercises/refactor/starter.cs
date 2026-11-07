foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        var stock = new Stock("ACME");
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
    private readonly Logger _logger = new();
    private readonly Chart _chart = new();
    private readonly Alerts _alerts = new();

    public void Attach(IStockObserver observer)
    {
        // TODO
    }

    public void Detach(IStockObserver observer)
    {
        // TODO
    }

    public void SetPrice(int price)
    {
        _logger.Log(symbol, price);
        _chart.Plot(price);
        _alerts.Check(symbol, price);
    }
}

public class Logger
{
    public void Log(string symbol, int price) => Screen.Lines.Add($"log: {symbol} is now {price}");
}

public class Chart
{
    public void Plot(int price) => Screen.Lines.Add($"chart: {price}");
}

public class Alerts
{
    public void Check(string symbol, int price)
    {
        if (price > 103) Screen.Lines.Add($"alert: {symbol} above 103");
    }
}
