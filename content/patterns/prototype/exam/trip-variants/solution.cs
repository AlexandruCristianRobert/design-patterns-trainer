var list = new TripList();
var alps = new RoadTrip("Alps loop", "camper van", 900);
alps.Stops.AddRange(["Munich", "Innsbruck", "Bolzano"]);
list.Add(alps);

var longer = list.SaveAsNew(alps, "Alps loop with Verona");
longer.Stops.Add("Verona");
longer.Budget.Euros = 1100;
Console.WriteLine(alps.Summary());
Console.WriteLine(longer.Summary());
Console.WriteLine($"{list.Count} trips");

// How much a trip may cost. A trip holds it as a separate object.
public class Budget(int euros)
{
    public int Euros { get; set; } = euros;
}

// Every trip can make an independent duplicate of itself. The list only ever sees ITrip.
public interface ITrip
{
    string Name { get; set; }
    List<string> Stops { get; }
    Budget Budget { get; }
    string Summary();
    ITrip Duplicate();
}

public static class Route
{
    public static string Of(List<string> stops) => stops.Count == 0 ? "no stops yet" : string.Join(" > ", stops);
}

public class RoadTrip(string name, string car, int euros) : ITrip
{
    public string Name { get; set; } = name;
    public List<string> Stops { get; private set; } = [];
    public Budget Budget { get; private set; } = new(euros);

    public string Summary() => $"{Name}: road trip by {car}, {Budget.Euros} EUR: {Route.Of(Stops)}";

    // MemberwiseClone copies each field as it is, so the stops and the budget are replaced with copies.
    public ITrip Duplicate()
    {
        var copy = (RoadTrip)MemberwiseClone();
        copy.Stops = [.. Stops];
        copy.Budget = new Budget(Budget.Euros);
        return copy;
    }
}

public class CityBreak : ITrip
{
    private readonly string hotel;

    public CityBreak(string name, string hotel, int euros)
    {
        Name = name;
        this.hotel = hotel;
        Budget = new Budget(euros);
    }

    // A copy constructor: the same hotel, plus stops and a budget of its own.
    private CityBreak(CityBreak other) : this(other.Name, other.hotel, other.Budget.Euros) => Stops.AddRange(other.Stops);

    public string Name { get; set; }
    public List<string> Stops { get; } = [];
    public Budget Budget { get; }

    public string Summary() => $"{Name}: city break at {hotel}, {Budget.Euros} EUR: {Route.Of(Stops)}";

    public ITrip Duplicate() => new CityBreak(this);
}

// The user's trips. Saving as new adds a separate trip that is edited on its own from then on.
public class TripList
{
    private readonly List<ITrip> trips = [];

    public int Count => trips.Count;

    public void Add(ITrip trip) => trips.Add(trip);

    public ITrip SaveAsNew(ITrip trip, string name)
    {
        var copy = trip.Duplicate();
        copy.Name = name;
        trips.Add(copy);
        return copy;
    }
}
