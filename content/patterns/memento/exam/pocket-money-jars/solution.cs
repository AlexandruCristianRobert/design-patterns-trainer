var jars = new Jars();
jars.Put("spend", 10);
var moves = new MoneyMoves(jars);
moves.Add("spend", "save", 6);
moves.Add("spend", "give", 6);
Console.WriteLine($"{moves.Apply()}: {jars.Show()}");
moves.Add("spend", "save", 4);
Console.WriteLine($"{moves.Apply()}: {jars.Show()}");

// What the moves keep while they run. It is empty, so they can hold the totals but not read them.
public interface IJarTotals
{
}

// A child's three money jars, in whole euros.
public class Jars
{
    private static readonly string[] Names = ["spend", "save", "give"];

    private readonly Dictionary<string, int> euros = new() { ["spend"] = 0, ["save"] = 0, ["give"] = 0 };

    public int In(string jar) => euros[jar];

    public void Put(string jar, int amount) => euros[jar] += amount;

    public bool Take(string jar, int amount)
    {
        if (euros[jar] < amount) return false;
        euros[jar] -= amount;
        return true;
    }

    public string Show() => string.Join(", ", Names.Select(n => $"{n} {euros[n]}"));

    // A new dictionary, so later changes do not reach the saved totals.
    public IJarTotals Save() => new Totals(new Dictionary<string, int>(euros));

    public void Restore(IJarTotals totals)
    {
        foreach (var (jar, amount) in ((Totals)totals).Euros) euros[jar] = amount;
    }

    private sealed record Totals(IReadOnlyDictionary<string, int> Euros) : IJarTotals;
}

// Moves money between jars all together: if one move can't be made, none of them is.
public class MoneyMoves(Jars jars)
{
    private readonly List<(string From, string To, int Euros)> waiting = [];

    public int Waiting => waiting.Count;

    public void Add(string from, string to, int euros) => waiting.Add((from, to, euros));

    public bool Apply()
    {
        var before = jars.Save();
        var moves = waiting.ToList();
        waiting.Clear();
        foreach (var (from, to, euros) in moves)
        {
            if (!jars.Take(from, euros))
            {
                jars.Restore(before);
                return false;
            }
            jars.Put(to, euros);
        }
        return true;
    }
}
