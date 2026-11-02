foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var fresh = new TankPlanner("fresh");
        var salt = new TankPlanner("salt");
        return
        [
            fresh.Plan("Living room", 60),
            salt.Plan("Reef", 200),
            fresh.Plan("Office", 25),
        ];
    }
}

public interface IFilter
{
    // The filter for a tank of this many litres.
    string Describe(int litres);
}

public interface IFishFood
{
    string Describe();
}

public class SpongeFilter : IFilter
{
    public string Describe(int litres) => $"sponge filter, {litres * 4} L/h";
}

public class ProteinSkimmer : IFilter
{
    public string Describe(int litres) => $"protein skimmer, {litres * 10} L/h";
}

public class FlakeFood : IFishFood
{
    public string Describe() => "flake food";
}

public class FrozenShrimp : IFishFood
{
    public string Describe() => "frozen brine shrimp";
}

// The planner is told the kind of water, and picks the filter and the food with two separate switches.
// A new kind of water means editing both switches, and keeping them in step by hand.
public class TankPlanner(string water)
{
    public string Plan(string tank, int litres)
    {
        IFilter filter = water switch
        {
            "fresh" => new SpongeFilter(),
            "salt" => new ProteinSkimmer(),
            _ => throw new ArgumentException($"unknown water: {water}"),
        };
        IFishFood food = water switch
        {
            "fresh" => new FlakeFood(),
            "salt" => new FrozenShrimp(),
            _ => throw new ArgumentException($"unknown water: {water}"),
        };
        return $"{tank}, {litres} L: {filter.Describe(litres)}, {food.Describe()}";
    }
}
