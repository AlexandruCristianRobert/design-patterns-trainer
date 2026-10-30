var business = new BoardingDesk(new BusinessCabin());
Console.WriteLine(business.Board("Ana", 2));

var economy = new BoardingDesk(new EconomyCabin());
Console.WriteLine(economy.Board("Radu", 31));
Console.WriteLine(economy.Board("Zoe", 32));
Console.WriteLine($"boarded: {business.Boarded} business, {economy.Boarded} economy");

public interface ISeat
{
    string Name { get; }
    int Row { get; }
}

public interface IAmenity
{
    string Name { get; }
}

public class FlatBedSeat(int row) : ISeat
{
    public string Name => "lie-flat bed";
    public int Row => row;
}

public class StandardSeat(int row) : ISeat
{
    public string Name => "standard seat";
    public int Row => row;
}

public class AmenityPouch : IAmenity
{
    public string Name => "amenity pouch";
}

public class SnackBox : IAmenity
{
    public string Name => "snack box";
}

// Hands out the seat and the amenity of one cabin, so a passenger never gets a mix of two cabins.
public abstract class Cabin
{
    public abstract ISeat SeatInRow(int row);
    public abstract IAmenity HandOut();
}

public class BusinessCabin : Cabin
{
    public override ISeat SeatInRow(int row) => new FlatBedSeat(row);
    public override IAmenity HandOut() => new AmenityPouch();
}

public class EconomyCabin : Cabin
{
    public override ISeat SeatInRow(int row) => new StandardSeat(row);
    public override IAmenity HandOut() => new SnackBox();
}

public class BoardingDesk(Cabin cabin)
{
    public int Boarded { get; private set; }

    public string Board(string passenger, int row)
    {
        var seat = cabin.SeatInRow(row);
        var amenity = cabin.HandOut();
        Boarded++;
        return $"{passenger}, row {seat.Row}: {seat.Name}, {amenity.Name}";
    }
}
