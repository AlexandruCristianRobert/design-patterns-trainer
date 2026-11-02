var app = new HireApp(new BoatHire(new Jetty(), new Lifejackets(), new CashBox()));
Console.WriteLine(app.Book("Ana", 2, 2));
Console.WriteLine(app.Book("Bo", 4, 3));
foreach (var line in HireLog.Lines)
    Console.WriteLine(line);

// Collects what the lake's classes did, in order.
public static class HireLog
{
    public static List<string> Lines { get; } = [];
}

public class Jetty
{
    // Boat 3 takes one or two people; boat 7 takes three or more.
    public int Assign(int people)
    {
        var boat = people <= 2 ? 3 : 7;
        HireLog.Lines.Add($"boat {boat} for {people} people");
        return boat;
    }

    public void Untie(int boat) => HireLog.Lines.Add($"boat {boat} untied");
}

public class Lifejackets
{
    public void Hand(int people) => HireLog.Lines.Add($"{people} lifejackets");
}

public class CashBox
{
    public void Take(string customer, int cents) => HireLog.Lines.Add($"took {cents} from {customer}");
}

// One call hires out a boat; it runs the steps in order so the app never has to.
public class BoatHire(Jetty jetty, Lifejackets lifejackets, CashBox cash)
{
    private const int CentsPerHour = 900;

    public int Rent(string customer, int people, int hours)
    {
        var boat = jetty.Assign(people);
        cash.Take(customer, hours * CentsPerHour);
        lifejackets.Hand(people);
        jetty.Untie(boat);
        return boat;
    }
}

// The booking app. It only knows BoatHire.
public class HireApp(BoatHire hire)
{
    public string Book(string customer, int people, int hours) =>
        $"{customer}: boat {hire.Rent(customer, people, hours)} for {hours} h";
}
