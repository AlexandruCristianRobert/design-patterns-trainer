var route = new BusRoute();
route.AddStop("Station");
route.AddStop("Market");
route.AddStop("Castle Street");
route.AddStop("Hospital");
route.AddStop("Airport");
route.Close("Castle Street");

Console.WriteLine($"out: {string.Join(", ", route.Outbound())}");
Console.WriteLine($"back: {string.Join(", ", route.Inbound())}");

// The stops of a night bus, from the first to the last. Stops closed for roadworks are left out of both runs.
public class BusRoute
{
    private readonly List<string> stops = [];
    private readonly HashSet<string> closed = [];

    public void AddStop(string name) => stops.Add(name);
    public void Close(string name) => closed.Add(name);
    public void Reopen(string name) => closed.Remove(name);

    public IEnumerable<string> Outbound()
    {
        foreach (var stop in stops)
            if (!closed.Contains(stop))
                yield return stop;
    }

    public IEnumerable<string> Inbound()
    {
        for (var i = stops.Count - 1; i >= 0; i--)
            if (!closed.Contains(stops[i]))
                yield return stops[i];
    }
}
