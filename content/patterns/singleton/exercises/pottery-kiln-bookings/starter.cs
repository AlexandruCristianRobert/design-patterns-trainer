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

// Every desk builds its own KilnBook. The bookings are shared only because they sit in a static field.
public class KilnBook
{
    private static readonly Dictionary<string, string> booked = [];

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
    public string Take(string day, string potter) => new KilnBook().Book(day, potter);
}

public class Website
{
    public string Take(string day, string potter) => new KilnBook().Book(day, potter);
}

public class StudioWall
{
    public string Show(string day) => new KilnBook().Who(day);
}
