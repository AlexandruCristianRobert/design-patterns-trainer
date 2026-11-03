var reception = new Reception(OfficeFloor.Rooms());
Console.WriteLine(reception.Request(2));
Console.WriteLine(reception.Request(2));
Console.WriteLine(reception.Request(12));
Console.WriteLine(reception.Request(4));
Console.WriteLine(reception.Request(25));

// Every room on the floor. Each one holds the room after it in the line.
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

    // Asks the next room. After the last one, no room is free.
    protected string Pass(int people) => next is null ? $"No room free for {people}" : next.Book(people);
}

public class Booth : Room
{
    private bool booked;

    public override string Book(int people)
    {
        if (booked || people > 2)
            return Pass(people);
        booked = true;
        return $"Booth booked for {people}";
    }
}

public class SmallRoom : Room
{
    private bool booked;

    public override string Book(int people)
    {
        if (booked || people > 6)
            return Pass(people);
        booked = true;
        return $"Small room booked for {people}";
    }
}

public class Hall : Room
{
    private bool booked;

    public override string Book(int people)
    {
        if (booked || people > 20)
            return Pass(people);
        booked = true;
        return $"Hall booked for {people}";
    }
}

// Puts a new line of free rooms together, smallest first, and returns the first room.
public static class OfficeFloor
{
    public static Room Rooms()
    {
        var booth = new Booth();
        booth.Then(new SmallRoom()).Then(new Hall());
        return booth;
    }
}

// The reception desk knows only the first room.
public class Reception(Room firstRoom)
{
    public string Request(int people) => firstRoom.Book(people);
}
