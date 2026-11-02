var kinds = new PieceKinds();
var mosaic = new Mosaic(kinds);
for (var x = 0; x < 10; x++)
    for (var y = 0; y < 10; y++)
        mosaic.Place(x, y, (x + y) % 2 == 0 ? "blue" : "white", "glass");

Console.WriteLine(mosaic.Describe(3, 4));
Console.WriteLine($"Cost: {mosaic.Cost()} cents");
Console.WriteLine($"Kinds created: {kinds.Created}");

// What every piece of one colour and material has in common. It never changes, so all those pieces share it.
public sealed class PieceKind(string colour, string material, int cents)
{
    public string Colour { get; } = colour;
    public string Material { get; } = material;
    public int Cents { get; } = cents;
}

// Hands out one PieceKind per colour and material, and creates it only the first time that pair is asked for.
public class PieceKinds
{
    private static readonly Dictionary<string, int> Prices = new() { ["glass"] = 12, ["stone"] = 8, ["marble"] = 25 };

    private readonly Dictionary<(string Colour, string Material), PieceKind> made = new();

    public int Created => made.Count;

    public PieceKind Get(string colour, string material)
    {
        if (!made.TryGetValue((colour, material), out var kind))
        {
            kind = new PieceKind(colour, material, Prices[material]);
            made[(colour, material)] = kind;
        }
        return kind;
    }
}

// The mosaic keeps, for each position, only a reference to the shared kind.
public class Mosaic(PieceKinds kinds)
{
    private readonly Dictionary<(int X, int Y), PieceKind> pieces = new();

    public void Place(int x, int y, string colour, string material) => pieces[(x, y)] = kinds.Get(colour, material);

    public PieceKind KindAt(int x, int y) => pieces[(x, y)];

    public string Describe(int x, int y)
    {
        var kind = pieces[(x, y)];
        return $"{kind.Colour} {kind.Material} at {x},{y}";
    }

    public int Cost() => pieces.Values.Sum(k => k.Cents);
}
