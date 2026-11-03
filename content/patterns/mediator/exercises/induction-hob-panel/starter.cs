foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var hob = new Hob();
        var lines = new List<string>();
        void Show() => lines.Add($"zones {string.Join(" ", hob.Zones.Select(z => z.Level))}, hood {hob.Hood.Speed}, lock {(hob.Lock.IsOn ? "on" : "off")}");

        Show();
        hob.Zones[0].SetLevel(5);
        Show();
        hob.Zones[1].SetLevel(9);
        Show();
        hob.Zones[2].SetLevel(9);
        Show();
        hob.Zones[3].SetLevel(2);
        Show();
        hob.Lock.Press();
        Show();
        hob.Zones[0].SetLevel(6);
        Show();
        hob.Lock.Press();
        hob.Zones[0].SetLevel(6);
        Show();
        return lines;
    }
}

// Builds the four cooking zones, the extractor hood and the child lock, and wires each of them to the ones it changes.
public class Hob
{
    public IReadOnlyList<CookingZone> Zones { get; }
    public ExtractorHood Hood { get; } = new();
    public ChildLock Lock { get; } = new();

    public Hob()
    {
        var zones = new List<CookingZone> { new(), new(), new(), new() };
        foreach (var zone in zones)
        {
            zone.Others = zones.Where(other => other != zone).ToList();
            zone.Hood = Hood;
            zone.Lock = Lock;
        }
        Lock.Zones = zones;
        Lock.Hood = Hood;
        Zones = zones;
    }
}

// One cooking zone, at a level from 0 (off) to 9 (boost).
public class CookingZone
{
    public List<CookingZone> Others = [];
    public ExtractorHood Hood = null!;
    public ChildLock Lock = null!;

    public int Level { get; set; }

    public void SetLevel(int level)
    {
        // While the child lock is on, the zone stays off.
        Level = Lock.IsOn ? 0 : level;
        // Only one zone can boost: another zone at 9 drops to 8.
        if (Level == 9)
            foreach (var other in Others)
                if (other.Level == 9) other.Level = 8;
        // The hood runs one step faster for each zone that is on, up to 3.
        Hood.Speed = Math.Min(3, Others.Count(o => o.Level > 0) + (Level > 0 ? 1 : 0));
    }
}

// The child lock button. Turning the lock on switches every zone off.
public class ChildLock
{
    public List<CookingZone> Zones = [];
    public ExtractorHood Hood = null!;

    public bool IsOn { get; private set; }

    public void Press()
    {
        IsOn = !IsOn;
        if (IsOn)
        {
            foreach (var zone in Zones) zone.Level = 0;
            Hood.Speed = 0;
        }
    }
}

// The extractor hood above the hob. Its speed is set for it: 0 is off, 3 is the fastest.
public class ExtractorHood
{
    public int Speed { get; set; }
}
