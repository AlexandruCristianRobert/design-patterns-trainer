var booth = new Booth();
booth.Then(new SmallRoom()).Then(new Hall());
var reception = new Reception(booth);
Console.WriteLine(reception.Request(2));
Console.WriteLine(reception.Request(5));
Console.WriteLine(reception.Request(15));
Console.WriteLine(reception.Request(25));

// Every meeting room. Each one holds the room after it in the line.
public abstract class Room
{
    private Room? next;

    // Puts a room after this one and returns it, so the calls can follow each other.
    public Room Then(Room next)
    {
        this.next = next;
        return next;
    }

    public abstract string Book(int people);

    // Asks the next room. After the last one, no room is left.
    protected string Pass(int people) => next is null ? $"No room for {people}" : next.Book(people);
}

public class Booth : Room
{
    public override string Book(int people) => people <= 2 ? $"Booth booked for {people}" : Pass(people);
}

public class SmallRoom : Room
{
    public override string Book(int people) => people <= 6 ? $"Small room booked for {people}" : Pass(people);
}

public class Hall : Room
{
    public override string Book(int people) => people <= 20 ? $"Hall booked for {people}" : Pass(people);
}

// The reception desk knows only the first room.
public class Reception(Room firstRoom)
{
    public string Request(int people) => firstRoom.Book(people);
}
