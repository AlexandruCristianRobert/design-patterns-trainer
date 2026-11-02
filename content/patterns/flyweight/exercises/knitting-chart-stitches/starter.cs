var kinds = new StitchKinds();
var chart = new Chart(kinds);
for (var column = 1; column <= 6; column++)
    chart.Add(1, column, column % 2 == 1 ? "knit" : "purl");

Console.WriteLine($"Stitches: {chart.Count}");
Console.WriteLine($"Kinds created: {kinds.Created}");
Console.WriteLine(chart.Describe(0));
Console.WriteLine(chart.Describe(1));

// What every stitch of one kind has in common. It never changes, so all those stitches can share it.
public sealed class StitchKind(string name, char symbol)
{
    public string Name { get; } = name;
    public char Symbol { get; } = symbol;

    public string Describe(int row, int column) => $"row {row}, column {column}: {Name} {Symbol}";
}

// Should hand out one StitchKind per name, and create it only the first time that name is asked for.
public class StitchKinds
{
    private static readonly Dictionary<string, char> Symbols = new()
    {
        ["knit"] = '|',
        ["purl"] = '-',
        ["cable"] = 'X',
    };

    private readonly Dictionary<string, StitchKind> made = new();

    public int Created => made.Count;

    public StitchKind Get(string name)
    {
        // TODO: this creates a new kind on every call, so a chart of 40,000 stitches holds 40,000 kinds.
        // Return the same object for the same name, and create it (and remember it in `made`) only the first time.
        return new StitchKind(name, Symbols[name]);
    }
}

// One stitch on the chart: where it is, and a reference to its shared kind.
public readonly record struct Stitch(int Row, int Column, StitchKind Kind);

public class Chart(StitchKinds kinds)
{
    private readonly List<Stitch> stitches = [];

    public int Count => stitches.Count;

    public StitchKind KindAt(int index) => stitches[index].Kind;

    // TODO: add a Stitch with the row, the column and the shared kind for this name. Never create a StitchKind here.
    public void Add(int row, int column, string stitch) { }

    public string Describe(int index) => stitches[index].Kind.Describe(stitches[index].Row, stitches[index].Column);
}
