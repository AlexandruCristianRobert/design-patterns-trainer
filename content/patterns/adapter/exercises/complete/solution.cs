using System.Globalization;

var feed = new SeaOfficeFeed("LW 0148 2.3", "HW 0757 14.1", "LW 1412 1.9", "HW 2021 13.6");
var board = new HarbourBoard(new SeaOfficeTides(feed));
foreach (var line in board.Lines())
    Console.WriteLine(line);

// What the harbour board expects: a time of day, a height in metres, and high or low water.
public record Tide(TimeOnly Time, double Metres, bool High);

public interface ITideTable
{
    IReadOnlyList<Tide> Tides();
}

// The harbour board. It only knows ITideTable. Leave it as it is.
public class HarbourBoard(ITideTable table)
{
    public List<string> Lines() =>
        table.Tides()
             .Select(t => $"{t.Time.ToString("HH:mm", CultureInfo.InvariantCulture)} {(t.High ? "high" : "low")} {t.Metres.ToString("F1", CultureInfo.InvariantCulture)} m")
             .ToList();
}

// The sea office's library. It belongs to the sea office, so it stays as it is.
// Each reading looks like "HW 0612 13.8": HW or LW, the time as hhmm, the height in feet.
public sealed class SeaOfficeFeed(params string[] readings)
{
    public string[] Readings() => readings;
}

// The adapter: the board asks it for tides, and it asks the feed for readings and converts them.
public class SeaOfficeTides(SeaOfficeFeed feed) : ITideTable
{
    private const double MetresPerFoot = 0.3048;

    public IReadOnlyList<Tide> Tides()
    {
        var tides = new List<Tide>();
        foreach (var reading in feed.Readings())
        {
            var parts = reading.Split(' ');   // for example ["HW", "0612", "13.8"]
            var high = parts[0] == "HW";
            var time = TimeOnly.ParseExact(parts[1], "HHmm", CultureInfo.InvariantCulture);
            var feet = double.Parse(parts[2], CultureInfo.InvariantCulture);
            tides.Add(new Tide(time, feet * MetresPerFoot, high));
        }
        return tides;
    }
}
