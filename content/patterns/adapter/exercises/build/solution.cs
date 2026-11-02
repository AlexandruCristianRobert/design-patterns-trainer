var map = new ChargerMap(
[
    new VoltNetChargers(new VoltNetApi(new VoltPoint("VN-Station", 50.0, "AVAILABLE"), new VoltPoint("VN-Library", 7.4, "IN_USE"))),
    new AmpGridChargers(new AmpGridService("Mall level 2;22000;0", "Depot;3700;0")),
]);
Console.WriteLine($"free, 20 kW or more: {string.Join(", ", map.FreeChargers(20))}");
Console.WriteLine($"free, any power: {string.Join(", ", map.FreeChargers(0))}");

// What the charging map expects from every network.
public record Charger(string Name, int Kilowatts, bool Free);

public interface IChargerNetwork
{
    IReadOnlyList<Charger> Chargers();
}

// VoltNet's library. State is "AVAILABLE", "IN_USE" or "OFFLINE".
public record VoltPoint(string Id, double Kw, string State);

public sealed class VoltNetApi(params VoltPoint[] points)
{
    public VoltPoint[] ListPoints() => points;
}

// AmpGrid's library. Each row looks like "Mall level 2;22000;0": the name, the power in watts, and 1 when busy or 0 when not.
public class AmpGridService(params string[] rows)
{
    public string[] Export() => rows;
}

// Fits VoltNet to the map: asks the API for its points and converts each one.
public class VoltNetChargers(VoltNetApi api) : IChargerNetwork
{
    public IReadOnlyList<Charger> Chargers() =>
        api.ListPoints().Select(p => new Charger(p.Id, (int)p.Kw, p.State == "AVAILABLE")).ToList();
}

// Fits AmpGrid to the map: asks the service for its rows and converts each one.
public class AmpGridChargers(AmpGridService service) : IChargerNetwork
{
    public IReadOnlyList<Charger> Chargers() =>
        service.Export()
               .Select(row => row.Split(';'))
               .Select(parts => new Charger(parts[0], int.Parse(parts[1]) / 1000, parts[2] == "0"))
               .ToList();
}

// The map only knows IChargerNetwork, so a new network needs one new class and no change here.
public class ChargerMap(List<IChargerNetwork> networks)
{
    public List<string> FreeChargers(int minKilowatts) =>
        networks.SelectMany(n => n.Chargers())
                .Where(c => c.Free && c.Kilowatts >= minKilowatts)
                .Select(c => c.Name)
                .ToList();
}
