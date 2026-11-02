// One table, set up carefully once. The plan only ever sees an ITable.
var template = new RoundTable("lilies");
template.AddChair("chair 1");
template.AddChair("chair 2");

var plan = new SeatingPlan();
var copy = plan.Copy(template);
copy.AddChair("high chair");
Console.WriteLine($"Original: {template.Describe()}");
Console.WriteLine($"Copy: {copy.Describe()} [{copy.GetType().Name}]");

// A different kind of table is copied the same way, with no change to the plan.
var banquet = new LongTable("tulips", 6);
banquet.AddChair("chair 1");
Console.WriteLine($"Long copy: {plan.Copy(banquet).Describe()}");

// The contract: every table can copy itself.
public interface ITable
{
    void AddChair(string name);
    string Describe();
    ITable Clone();
}

public class RoundTable : ITable
{
    private readonly string centrepiece;
    private readonly List<string> chairs = new();

    public RoundTable(string centrepiece) => this.centrepiece = centrepiece;

    public void AddChair(string name) => chairs.Add(name);
    public string Describe() => $"round, {centrepiece}, chairs: {string.Join(", ", chairs)}";

    // A deep copy: the same settings, and a chair list of its own.
    public ITable Clone()
    {
        var copy = new RoundTable(centrepiece);
        foreach (var chair in chairs) copy.AddChair(chair);
        return copy;
    }
}

public class LongTable : ITable
{
    private readonly string centrepiece;
    private readonly int metres;
    private readonly List<string> chairs = new();

    public LongTable(string centrepiece, int metres)
    {
        this.centrepiece = centrepiece;
        this.metres = metres;
    }

    public void AddChair(string name) => chairs.Add(name);
    public string Describe() => $"long {metres} m, {centrepiece}, chairs: {string.Join(", ", chairs)}";

    public ITable Clone()
    {
        var copy = new LongTable(centrepiece, metres);
        foreach (var chair in chairs) copy.AddChair(chair);
        return copy;
    }
}

// The client: copies any configured table without knowing its class.
public class SeatingPlan
{
    private readonly List<ITable> tables = new();

    public ITable Copy(ITable template)
    {
        var table = template.Clone();
        tables.Add(table);
        return table;
    }
}
