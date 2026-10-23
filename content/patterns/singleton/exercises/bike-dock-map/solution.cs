Console.WriteLine($"File reads before the first use: {DockFile.Reads}");

var rider = DockMap.Instance;
Console.WriteLine($"Harbour has {rider.Bikes("Harbour")} bikes");
Console.WriteLine($"Ana takes one: {rider.Take("Harbour")}");

var screen = DockMap.Instance;
Console.WriteLine($"The dock screen shows {screen.Bikes("Harbour")} at Harbour");
Console.WriteLine($"File reads: {DockFile.Reads}");

// The file with every dock and its bikes. Reading it is slow. Leave this class as it is.
public static class DockFile
{
    public static int Reads { get; private set; }

    public static Dictionary<string, int> Read()
    {
        Reads++;
        return new() { ["Harbour"] = 6, ["Old Town"] = 2, ["Station"] = 0 };
    }
}

public sealed class DockMap
{
    // Lazy<T> builds the map the first time Value is read, once, even when two threads ask at the same moment.
    private static readonly Lazy<DockMap> map = new(() => new DockMap());

    public static DockMap Instance => map.Value;

    private readonly Dictionary<string, int> bikes = DockFile.Read();

    private DockMap() { }

    public int Bikes(string dock) => bikes.GetValueOrDefault(dock);

    public bool Take(string dock)
    {
        if (Bikes(dock) == 0) return false;
        bikes[dock]--;
        return true;
    }

    public void Return(string dock) => bikes[dock] = Bikes(dock) + 1;
}
