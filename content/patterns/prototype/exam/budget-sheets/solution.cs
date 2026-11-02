var shelf = new SheetShelf();
var household = new SpendingSheet("EUR", 1200);
household.Categories.AddRange(["rent", "food", "transport"]);
shelf.Put("household", household);

var student = new SavingsSheet("RON", 300, 5000);
student.Categories.AddRange(["emergency fund", "laptop"]);
shelf.Put("student savings", student);

var mine = shelf.Take("household");
mine.Categories.Add("gym");
mine.Limit.Monthly = 1500;
Console.WriteLine(mine.Describe());
Console.WriteLine(shelf.Take("household").Describe());
Console.WriteLine(shelf.Take("student savings").Describe());

// The monthly amount of a sheet. A sheet holds it as a separate object.
public class Limit(int monthly)
{
    public int Monthly { get; set; } = monthly;
}

// Every sheet can copy itself. The shelf only ever sees ISheet.
public interface ISheet
{
    List<string> Categories { get; }
    Limit Limit { get; }
    string Describe();
    ISheet Copy();
}

public static class Lists
{
    public static string Of(List<string> categories) => categories.Count == 0 ? "no categories" : string.Join(", ", categories);
}

public class SpendingSheet(string currency, int monthly) : ISheet
{
    public List<string> Categories { get; } = [];
    public Limit Limit { get; } = new(monthly);

    public string Describe() => $"spending in {currency}, at most {Limit.Monthly} a month: {Lists.Of(Categories)}";

    // Written by hand: the same currency, plus categories and a limit of its own.
    public ISheet Copy()
    {
        var copy = new SpendingSheet(currency, Limit.Monthly);
        copy.Categories.AddRange(Categories);
        return copy;
    }
}

public class SavingsSheet(string currency, int monthly, int target) : ISheet
{
    public List<string> Categories { get; private set; } = [];
    public Limit Limit { get; private set; } = new(monthly);

    public string Describe() => $"savings in {currency} towards {target}, {Limit.Monthly} a month: {Lists.Of(Categories)}";

    // MemberwiseClone copies each field as it is, so the categories and the limit are replaced with copies.
    public ISheet Copy()
    {
        var copy = (SavingsSheet)MemberwiseClone();
        copy.Categories = [.. Categories];
        copy.Limit = new Limit(Limit.Monthly);
        return copy;
    }
}

// The ready-made sheets the app offers. Each Take hands out a new sheet set up like the stored one.
public class SheetShelf
{
    private readonly Dictionary<string, ISheet> sheets = [];

    public void Put(string name, ISheet sheet) => sheets[name] = sheet;

    public ISheet Take(string name) =>
        sheets.TryGetValue(name, out var sheet) ? sheet.Copy() : throw new KeyNotFoundException($"No sheet called {name}.");
}
