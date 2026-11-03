var agency = new Agency([new Flat(3, 2, true), new House(4, 120), new Plot(800)]);
Console.WriteLine($"fees a month: {agency.Fees()} EUR");
foreach (var card in agency.Cards())
    Console.WriteLine(card);

// A listing hands itself to a visitor, which returns its answer for that listing.
public interface IListing
{
    T Accept<T>(IListingVisitor<T> visitor);
}

public interface IListingVisitor<T>
{
    T Visit(Flat flat);
    T Visit(House house);
    T Visit(Plot plot);
}

public class Flat(int rooms, int floor, bool lift) : IListing
{
    public int Rooms { get; } = rooms;
    public int Floor { get; } = floor;
    public bool Lift { get; } = lift;

    public T Accept<T>(IListingVisitor<T> visitor) => visitor.Visit(this);
}

public class House(int rooms, int garden) : IListing
{
    public int Rooms { get; } = rooms;
    public int Garden { get; } = garden;

    public T Accept<T>(IListingVisitor<T> visitor) => visitor.Visit(this);
}

public class Plot(int area) : IListing
{
    public int Area { get; } = area;

    public T Accept<T>(IListingVisitor<T> visitor) => visitor.Visit(this);
}

// The agency's fee a month for one listing.
public class MonthlyFees : IListingVisitor<int>
{
    public int Visit(Flat flat) => 20 * flat.Rooms;
    public int Visit(House house) => 30 * house.Rooms + house.Garden / 10;
    public int Visit(Plot plot) => 50;
}

// The card in the shop window for one listing.
public class WindowCards : IListingVisitor<string>
{
    public string Visit(Flat flat) =>
        $"{flat.Rooms}-room flat, {(flat.Floor == 0 ? "ground floor" : $"floor {flat.Floor}")}, {(flat.Lift ? "lift" : "no lift")}";

    public string Visit(House house) =>
        $"{house.Rooms}-room house, {(house.Garden == 0 ? "no garden" : $"{house.Garden} m² garden")}";

    public string Visit(Plot plot) => $"building plot, {plot.Area} m²";
}

public class Agency(List<IListing> listings)
{
    public int Fees() => listings.Sum(listing => listing.Accept(new MonthlyFees()));

    public List<string> Cards() => listings.Select(listing => listing.Accept(new WindowCards())).ToList();
}
