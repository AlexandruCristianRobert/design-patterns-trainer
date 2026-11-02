// Many seats, five shared styles. Each seat keeps only its position and a reference to a style.
var catalog = new SeatStyleCatalog();
var map = new SeatMap(catalog);
string[] bands = ["gold", "red", "blue", "green", "grey"];
for (var row = 1; row <= bands.Length; row++)
    for (var number = 1; number <= 8; number++)
        map.AddSeat(row, number, bands[row - 1]);

Console.WriteLine($"Seats: {map.Count}");
Console.WriteLine($"Styles created: {catalog.Created}");
Console.WriteLine($"Seats 1 and 2 share one style: {ReferenceEquals(map[0].Style, map[1].Style)}");
Console.WriteLine(map.Describe(0));

public sealed record SeatStyle(string Band, string Colour, string Icon)
{
    public string Describe(int row, int number) => $"Row {row} seat {number} is {Band}";
}

public readonly record struct SeatSpot(int Row, int Number, SeatStyle Style);

public class SeatStyleCatalog
{
    private static readonly Dictionary<string, (string Colour, string Icon)> Bands = new()
    {
        ["gold"] = ("#d4a017", "star"),
        ["red"] = ("#c0392b", "heart"),
        ["blue"] = ("#2e6fb7", "circle"),
        ["green"] = ("#2e8b57", "square"),
        ["grey"] = ("#888888", "dot"),
    };

    private readonly Dictionary<string, SeatStyle> styles = new();

    public int Created => styles.Count;

    public SeatStyle Get(string band)
    {
        if (!styles.TryGetValue(band, out var style))
        {
            var (colour, icon) = Bands[band];
            style = new SeatStyle(band, colour, icon);
            styles[band] = style;
        }
        return style;
    }
}

public class SeatMap(SeatStyleCatalog catalog)
{
    private readonly List<SeatSpot> spots = [];

    public int Count => spots.Count;

    public SeatSpot this[int index] => spots[index];

    public void AddSeat(int row, int number, string band) => spots.Add(new SeatSpot(row, number, catalog.Get(band)));

    public string Describe(int index) => spots[index].Style.Describe(spots[index].Row, spots[index].Number);
}
