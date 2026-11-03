var park = new Park(
[
    new Zone("Wild West", [new Ride("Gold Rush", 24), new FoodStall("Taco Hut"), new Zone("Little Town", [new Ride("Pony Ride", 6)])]),
    new Ride("Big Dipper", 40),
]);
Console.WriteLine($"staff: {park.StaffNeeded()}");
foreach (var line in park.SafetyList())
    Console.WriteLine(line);

public interface IAttraction
{
    void Host(IParkRound round);
}

// One method for each kind of attraction. A new round of the park is a new class of this type.
public interface IParkRound
{
    void StopAt(Ride ride);
    void StopAt(FoodStall stall);
    void StopAt(Zone zone);
}

public class Ride(string name, int seats) : IAttraction
{
    public string Name { get; } = name;
    public int Seats { get; } = seats;

    public void Host(IParkRound round) => round.StopAt(this);
}

public class FoodStall(string name) : IAttraction
{
    public string Name { get; } = name;

    public void Host(IParkRound round) => round.StopAt(this);
}

public class Zone(string name, List<IAttraction> inside) : IAttraction
{
    public string Name { get; } = name;
    public List<IAttraction> Inside { get; } = inside;

    public void Host(IParkRound round) => round.StopAt(this);
}

// Each round goes on into the attractions inside a zone itself.
public class StaffRota : IParkRound
{
    public int Total { get; private set; }

    public void StopAt(Ride ride) => Total += (ride.Seats + 19) / 20;
    public void StopAt(FoodStall stall) => Total += 2;

    public void StopAt(Zone zone)
    {
        Total += 1;
        foreach (var attraction in zone.Inside) attraction.Host(this);
    }
}

public class SafetyRound : IParkRound
{
    public List<string> Lines { get; } = new();

    public void StopAt(Ride ride) => Lines.Add($"{ride.Name}: check the belts");
    public void StopAt(FoodStall stall) => Lines.Add($"{stall.Name}: check the fryer");

    public void StopAt(Zone zone)
    {
        Lines.Add($"{zone.Name}: check the gates");
        foreach (var attraction in zone.Inside) attraction.Host(this);
    }
}

public class Park(List<IAttraction> attractions)
{
    public int StaffNeeded()
    {
        var rota = new StaffRota();
        foreach (var attraction in attractions) attraction.Host(rota);
        return rota.Total;
    }

    public List<string> SafetyList()
    {
        var round = new SafetyRound();
        foreach (var attraction in attractions) attraction.Host(round);
        return round.Lines;
    }
}
