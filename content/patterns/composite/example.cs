var burger = new MenuItem("Burger", 9);
var fries = new MenuItem("Fries", 4);
var soda = new MenuItem("Soda", 3);

// A combo is an entry too, so one combo can hold another.
var sides = new Combo("Sides", [fries, soda]);
var lunch = new Combo("Lunch", [burger, sides]);

var ticket = new OrderTicket();
ticket.Add(lunch);
ticket.Add(soda);
ticket.Print();

public interface IMenuEntry
{
    int Price();
    string Describe();
}

public class MenuItem(string name, int price) : IMenuEntry
{
    public int Price() => price;
    public string Describe() => name;
}

public class Combo(string name, List<IMenuEntry> entries) : IMenuEntry
{
    public int Price() => entries.Sum(e => e.Price());
    public string Describe() => $"{name} ({string.Join(", ", entries.Select(e => e.Describe()))})";
}

public class OrderTicket
{
    private readonly List<IMenuEntry> lines = [];

    public void Add(IMenuEntry entry) => lines.Add(entry);
    public int Total() => lines.Sum(l => l.Price());
    public void Print()
    {
        foreach (var line in lines)
            Console.WriteLine($"{line.Price()}  {line.Describe()}");
        Console.WriteLine($"Total: {Total()}");
    }
}
