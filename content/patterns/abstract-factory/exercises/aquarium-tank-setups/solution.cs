foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var fresh = new TankPlanner(new FreshwaterSupplier());
        var salt = new TankPlanner(new MarineSupplier());
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

// Makes the filter and the food for one kind of water, so they always match.
public interface ITankSupplier
{
    IFilter MakeFilter();
    IFishFood MakeFood();
}

public class FreshwaterSupplier : ITankSupplier
{
    public IFilter MakeFilter() => new SpongeFilter();
    public IFishFood MakeFood() => new FlakeFood();
}

public class MarineSupplier : ITankSupplier
{
    public IFilter MakeFilter() => new ProteinSkimmer();
    public IFishFood MakeFood() => new FrozenShrimp();
}

public class TankPlanner(ITankSupplier supplier)
{
    public string Plan(string tank, int litres)
    {
        var filter = supplier.MakeFilter();
        var food = supplier.MakeFood();
        return $"{tank}, {litres} L: {filter.Describe(litres)}, {food.Describe()}";
    }
}
