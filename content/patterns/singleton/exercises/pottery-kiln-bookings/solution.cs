foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var desk = new FrontDesk();
        var web = new Website();
        var wall = new StudioWall();
        return
        [
            desk.Take("Monday", "Ana"),
            web.Take("Monday", "Radu"),
            web.Take("Thursday", "Radu"),
            wall.Show("Monday"),
            wall.Show("Friday"),
        ];
    }
}

// The studio's one kiln book. The bookings belong to it, not to the class.
public sealed class KilnBook
{
    private static readonly object gate = new();
    private static volatile KilnBook? book;

    public static KilnBook Instance
    {
        get
        {
            if (book is null)
                lock (gate)
                    book ??= new KilnBook();
            return book;
        }
    }

    private readonly Dictionary<string, string> booked = [];

    private KilnBook() { }

    public string Book(string day, string potter)
    {
        if (booked.TryGetValue(day, out var holder) && holder != potter)
            return $"{potter}: {day} is taken by {holder}";
        booked[day] = potter;
        return $"{potter}: kiln booked for {day}";
    }

    public string Who(string day) => booked.TryGetValue(day, out var holder) ? $"{day}: {holder}" : $"{day}: free";
}

public class FrontDesk
{
    public string Take(string day, string potter) => KilnBook.Instance.Book(day, potter);
}

public class Website
{
    public string Take(string day, string potter) => KilnBook.Instance.Book(day, potter);
}

public class StudioWall
{
    public string Show(string day) => KilnBook.Instance.Who(day);
}
