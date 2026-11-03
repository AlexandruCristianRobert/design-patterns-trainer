var listing = new Listing(
[
    new Cottage("Heron Lodge", 6, 180, ["hot tub", "garden", "dogs welcome"]),
    new Cottage("Moss Hut", 2, 70, ["dogs welcome"]),
    new Cottage("Old Mill", 8, 240, ["garden", "sauna"]),
]);

// A garden, and either cheap or for fewer than 7 people.
Console.WriteLine(listing.Find(new And(new WithFeature("garden"), new Or(new CostsAtMost(100), new Not(new SleepsAtLeast(7))))));
Console.WriteLine(listing.Find(new WithFeature("pool")));

public class Cottage(string name, int sleeps, int price, string[] features)
{
    public string Name => name;
    public int Sleeps => sleeps;
    public int Price => price;
    public bool Has(string feature) => features.Contains(feature);
}

// Every part of a search works out for itself whether a cottage matches.
public interface Search
{
    bool Matches(Cottage cottage);
}

public class SleepsAtLeast(int people) : Search
{
    public bool Matches(Cottage cottage) => cottage.Sleeps >= people;
}

public class CostsAtMost(int euros) : Search
{
    public bool Matches(Cottage cottage) => cottage.Price <= euros;
}

public class WithFeature(string feature) : Search
{
    public bool Matches(Cottage cottage) => cottage.Has(feature);
}

public class And(Search first, Search second) : Search
{
    public bool Matches(Cottage cottage) => first.Matches(cottage) && second.Matches(cottage);
}

public class Or(Search first, Search second) : Search
{
    public bool Matches(Cottage cottage) => first.Matches(cottage) || second.Matches(cottage);
}

public class Not(Search search) : Search
{
    public bool Matches(Cottage cottage) => !search.Matches(cottage);
}

// The cottages to rent, in the order they were listed. It only ever asks a search whether a cottage matches.
public class Listing(Cottage[] cottages)
{
    public string Find(Search search)
    {
        var names = cottages.Where(search.Matches).Select(c => c.Name).ToList();
        return names.Count == 0 ? "none" : string.Join(", ", names);
    }
}
