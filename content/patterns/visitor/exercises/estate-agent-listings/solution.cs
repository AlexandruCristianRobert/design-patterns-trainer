var agency = new Agency([new Flat(3, 2), new House(4, 120)]);
Console.WriteLine($"fees a month: {agency.Fees()} EUR");
foreach (var card in agency.Cards())
    Console.WriteLine(card);

// A listing hands itself to a visitor. Each visitor keeps its own result.
public interface IListing
{
    void Accept(ListingVisitor visitor);
}

public abstract class ListingVisitor
{
    public abstract void VisitFlat(Flat flat);
    public abstract void VisitHouse(House house);
}

public class Flat(int rooms, int floor) : IListing
{
    public int Rooms { get; } = rooms;
    public int Floor { get; } = floor;

    public void Accept(ListingVisitor visitor) => visitor.VisitFlat(this);
}

public class House(int rooms, int garden) : IListing
{
    public int Rooms { get; } = rooms;
    public int Garden { get; } = garden;

    public void Accept(ListingVisitor visitor) => visitor.VisitHouse(this);
}

// What the agency charges a month.
public class MonthlyFees : ListingVisitor
{
    public int Total { get; private set; }

    public override void VisitFlat(Flat flat) => Total += 20 * flat.Rooms;
    public override void VisitHouse(House house) => Total += 30 * house.Rooms;
}

// The cards in the shop window.
public class WindowCards : ListingVisitor
{
    public List<string> Cards { get; } = new();

    public override void VisitFlat(Flat flat) => Cards.Add($"{flat.Rooms}-room flat, floor {flat.Floor}");
    public override void VisitHouse(House house) => Cards.Add($"{house.Rooms}-room house, {house.Garden} m² garden");
}

public class Agency(List<IListing> listings)
{
    public int Fees()
    {
        var fees = new MonthlyFees();
        foreach (var listing in listings) listing.Accept(fees);
        return fees.Total;
    }

    public List<string> Cards()
    {
        var cards = new WindowCards();
        foreach (var listing in listings) listing.Accept(cards);
        return cards.Cards;
    }
}
