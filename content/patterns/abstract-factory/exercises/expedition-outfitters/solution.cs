var polar = new Expedition(new PolarOutfitter());
Console.WriteLine(polar.Equip(4));
Console.WriteLine($"2 L of water: {polar.BoilMinutes(2)} min");

var jungle = new Expedition(new JungleOutfitter());
Console.WriteLine(jungle.Equip(3));
Console.WriteLine($"2 L of water: {jungle.BoilMinutes(2)} min");

public interface IShelter
{
    string Name { get; }

    // How many people one shelter sleeps.
    int Sleeps { get; }
}

public interface IStove
{
    string Name { get; }
    int MinutesToBoil(int litres);
}

public interface IClothing
{
    string Name { get; }
}

public class SnowDome : IShelter
{
    public string Name => "snow dome tent";
    public int Sleeps => 3;
}

public class LiquidFuelStove : IStove
{
    public string Name => "liquid-fuel stove";
    public int MinutesToBoil(int litres) => litres * 6;
}

public class DownSuit : IClothing
{
    public string Name => "down suit";
}

public class Hammock : IShelter
{
    public string Name => "jungle hammock";
    public int Sleeps => 1;
}

public class TwigStove : IStove
{
    public string Name => "twig stove";
    public int MinutesToBoil(int litres) => litres * 9;
}

public class QuickDryShirt : IClothing
{
    public string Name => "quick-dry shirt";
}

// Packs the shelter, the stove and the clothing for one climate, so they always belong together.
public abstract class Outfitter
{
    public abstract IShelter PackShelter();
    public abstract IStove PackStove();
    public abstract IClothing PackClothing();
}

public class PolarOutfitter : Outfitter
{
    public override IShelter PackShelter() => new SnowDome();
    public override IStove PackStove() => new LiquidFuelStove();
    public override IClothing PackClothing() => new DownSuit();
}

public class JungleOutfitter : Outfitter
{
    public override IShelter PackShelter() => new Hammock();
    public override IStove PackStove() => new TwigStove();
    public override IClothing PackClothing() => new QuickDryShirt();
}

public class Expedition(Outfitter outfitter)
{
    public string Equip(int people)
    {
        var shelter = outfitter.PackShelter();
        var stove = outfitter.PackStove();
        var clothing = outfitter.PackClothing();
        var shelters = (people + shelter.Sleeps - 1) / shelter.Sleeps;
        return $"{people} people: {shelters} x {shelter.Name}, {stove.Name}, {people} x {clothing.Name}";
    }

    public int BoilMinutes(int litres) => outfitter.PackStove().MinutesToBoil(litres);
}
