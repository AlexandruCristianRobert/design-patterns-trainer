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

// Builds the three cooking zones and the extractor hood, gives each zone itself, and holds the rules.
public class Hob
{
    private readonly List<CookingZone> zones = [];

    public IReadOnlyList<CookingZone> Zones => zones;
    public ExtractorHood Hood { get; } = new();

    public Hob()
    {
        for (var i = 0; i < 3; i++) zones.Add(new CookingZone(this));
    }

    // Called by a zone after its level was set.
    public void Changed(CookingZone changed)
    {
        if (changed.Level == 9)
            foreach (var zone in zones)
                if (zone != changed && zone.Level == 9) zone.Switch(8);

        Hood.Run(zones.Count(z => z.Level > 0));
    }
}

// One cooking zone, at a level from 0 (off) to 9 (boost).
public class CookingZone(Hob hob)
{
    public int Level { get; private set; }

    public void SetLevel(int level)
    {
        Level = level;
        hob.Changed(this);
    }

    // Used by the hob: changes the level without telling anyone.
    public void Switch(int level) => Level = level;
}

// The extractor hood above the hob. Its speed is set for it.
public class ExtractorHood
{
    public int Speed { get; private set; }

    public void Run(int speed) => Speed = speed;
}
