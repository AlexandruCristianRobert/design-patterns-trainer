var counter = new HireCounter();
Console.WriteLine(counter.Ask("drill"));
Console.WriteLine(counter.Ask("drill"));
Console.WriteLine(counter.Ask("tile cutter"));
Console.WriteLine(counter.Ask("drill"));
Console.WriteLine(counter.Ask("drill"));

// Every place a tool can be hired from. Each one is created with the place after it, or with none.
public abstract class Branch(Branch? next)
{
    public abstract string Hire(string tool);

    // Asks the next place. After the last one, nobody has the tool.
    protected string Pass(string tool) => next?.Hire(tool) ?? $"No {tool} free anywhere";
}

public class TownShop(Branch? next = null) : Branch(next)
{
    private readonly List<string> stock = ["drill", "ladder"];

    public override string Hire(string tool) =>
        stock.Remove(tool) ? $"{tool} from the town shop, ready now" : Pass(tool);
}

public class Depot(Branch? next = null) : Branch(next)
{
    private readonly List<string> stock = ["drill", "tile cutter", "floor sander"];

    public override string Hire(string tool) =>
        stock.Remove(tool) ? $"{tool} from the depot, ready tomorrow" : Pass(tool);
}

public class PartnerShop(Branch? next = null) : Branch(next)
{
    private readonly List<string> stock = ["drill", "cement mixer"];

    public override string Hire(string tool) =>
        stock.Remove(tool) ? $"{tool} from the partner shop, ready in 3 days" : Pass(tool);
}

// The counter puts a new line of places together, nearest first, and keeps only the first.
public class HireCounter
{
    private readonly Branch first = new TownShop(new Depot(new PartnerShop()));

    public string Ask(string tool) => first.Hire(tool);
}
