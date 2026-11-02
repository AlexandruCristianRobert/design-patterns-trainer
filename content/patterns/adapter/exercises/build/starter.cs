// Write VoltNetChargers, AmpGridChargers and ChargerMap as described in the scenario.
// The types below are given. Leave them as they are.

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
