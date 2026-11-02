var counter = new BouquetBuilder()
    .AddStems("rose", 3)
    .AddStems("tulip", 2)
    .WithRibbon("red");
var first = counter.Build();
counter.InVase();
var second = counter.Build();
Console.WriteLine($"first: {first.Describe()}");
Console.WriteLine($"second: {second.Describe()}");

try
{
    new BouquetBuilder().AddStems("lily", 4).InVase().Build();
}
catch (InvalidOperationException problem)
{
    Console.WriteLine($"rejected: {problem.Message}");
}

// The finished bouquet. It has no setters, so nothing outside it can change it.
public class Bouquet(IReadOnlyList<(string Flower, int Count)> stems, string? ribbon, bool inVase)
{
    public int StemCount => stems.Sum(s => s.Count);

    public string Describe() =>
        string.Join(", ", stems.Select(s => $"{s.Flower} x{s.Count}")) +
        (ribbon is null ? "" : $", {ribbon} ribbon") +
        (inVase ? ", in a vase" : "");
}

// Collects the florist's choices, then checks them all at Build().
public class BouquetBuilder
{
    private readonly List<(string Flower, int Count)> stems = [];
    private string? ribbon;
    private bool inVase;

    public BouquetBuilder AddStems(string flower, int count)
    {
        stems.Add((flower, count));
        return this;
    }

    public BouquetBuilder WithRibbon(string colour)
    {
        ribbon = colour;
        return this;
    }

    public BouquetBuilder InVase()
    {
        // TODO: remember that the bouquet goes in a vase.
        return this;
    }

    public Bouquet Build()
    {
        // TODO: reject a bouquet without stems, and one in a vase with fewer than 5 stems.
        // TODO: later steps on this builder must not change the bouquet returned here.
        return new Bouquet(stems, ribbon, inVase);
    }
}
