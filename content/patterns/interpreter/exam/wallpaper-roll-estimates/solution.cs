// Strips of 53 cm across the north and east walls, then rolls of 10 metres, with 10 cm spare on each strip.
var strips = new DividedRoundUp(new Plus(new WallWidth("north"), new WallWidth("east")), 53);
var rolls = new DividedRoundUp(new Times(strips, new Plus(new RoomHeight(), new Length(10))), 1000);

var bedroom = new Room(250);
bedroom.AddWall("north", 400);
bedroom.AddWall("east", 300);
Console.WriteLine($"bedroom: {strips.Amount(bedroom)} strips, {rolls.Amount(bedroom)} rolls");

public class Room(int heightCm)
{
    private readonly Dictionary<string, int> walls = [];

    public int HeightCm => heightCm;
    public void AddWall(string name, int widthCm) => walls[name] = widthCm;
    public int WidthOf(string wall) => walls.GetValueOrDefault(wall);
}

// Every part of an estimate works out its own amount for a room.
public interface Measure
{
    int Amount(Room room);
}

public class Length(int amount) : Measure
{
    public int Amount(Room room) => amount;
}

public class WallWidth(string wall) : Measure
{
    public int Amount(Room room) => room.WidthOf(wall);
}

public class RoomHeight : Measure
{
    public int Amount(Room room) => room.HeightCm;
}

public class Plus(Measure first, Measure second) : Measure
{
    public int Amount(Room room) => first.Amount(room) + second.Amount(room);
}

public class Times(Measure first, Measure second) : Measure
{
    public int Amount(Room room) => first.Amount(room) * second.Amount(room);
}

public class DividedRoundUp(Measure measure, int by) : Measure
{
    public int Amount(Room room) => (measure.Amount(room) + by - 1) / by;
}
