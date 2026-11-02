var varieties = new Varieties();
var tray = new Tray(varieties);
tray.Sow(1, "basil", 5);
tray.Sow(2, "tomato", 5);
tray.Sow(3, "basil", 6);

for (var cell = 1; cell <= 3; cell++)
    Console.WriteLine(tray.Status(cell, 12));
Console.WriteLine($"Varieties created: {varieties.Created}");

// What every seedling of one variety has in common. It never changes, so all those seedlings share it.
public sealed record Variety(string Name, int DaysToSprout);

// Hands out one Variety per name, and creates it only the first time that name is asked for.
public class Varieties
{
    private static readonly Dictionary<string, int> Days = new() { ["basil"] = 7, ["tomato"] = 10, ["marigold"] = 5 };

    private readonly Dictionary<string, Variety> made = new();

    public int Created => made.Count;

    public Variety Get(string name)
    {
        if (!made.TryGetValue(name, out var variety))
        {
            variety = new Variety(name, Days[name]);
            made[name] = variety;
        }
        return variety;
    }
}

// A seedling in a cell: the day it was sown, and a reference to its shared variety.
public readonly record struct Seedling(int Day, Variety Variety);

public class Tray(Varieties varieties)
{
    private readonly Dictionary<int, Seedling> cells = new();

    public void Sow(int cell, string variety, int day) => cells[cell] = new Seedling(day, varieties.Get(variety));

    public Variety VarietyIn(int cell) => cells[cell].Variety;

    public string Status(int cell, int today)
    {
        var (day, variety) = cells[cell];
        var sprouts = day + variety.DaysToSprout;
        return today >= sprouts
            ? $"cell {cell}: {variety.Name}, sprouted"
            : $"cell {cell}: {variety.Name}, sprouts on day {sprouts}";
    }
}
