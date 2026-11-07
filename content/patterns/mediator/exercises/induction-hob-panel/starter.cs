foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var hob = new Hob();
        var lines = new List<string>();
        void Show() => lines.Add($"zones {string.Join(" ", hob.Zones.Select(z => z.Level))}, hood {hob.Hood.Speed}");

        Show();
        hob.Zones[0].SetLevel(5);
        Show();
        hob.Zones[1].SetLevel(9);
        Show();
        hob.Zones[2].SetLevel(9);
        Show();
        hob.Zones[0].SetLevel(0);
        Show();
        return lines;
    }
}

// Builds the three cooking zones and the extractor hood, and wires each zone to the other zones and the hood.
public class Hob
{
    public IReadOnlyList<CookingZone> Zones { get; }
    public ExtractorHood Hood { get; } = new();

    public Hob()
    {
        var zones = new List<CookingZone> { new(), new(), new() };
        foreach (var zone in zones)
        {
            zone.Others = zones.Where(other => other != zone).ToList();
            zone.Hood = Hood;
        }
        Zones = zones;
    }
}

// One cooking zone, at a level from 0 (off) to 9 (boost).
public class CookingZone
{
    public List<CookingZone> Others = [];
    public ExtractorHood Hood = null!;

    public int Level { get; set; }

    public void SetLevel(int level)
    {
        Level = level;
        // Only one zone can boost: another zone at 9 drops to 8.
        if (Level == 9)
            foreach (var other in Others)
                if (other.Level == 9) other.Level = 8;
        // The hood's speed is the number of zones that are on.
        Hood.Speed = Others.Count(o => o.Level > 0) + (Level > 0 ? 1 : 0);
    }
}

// The extractor hood above the hob. Its speed is set for it.
public class ExtractorHood
{
    public int Speed { get; set; }
}
