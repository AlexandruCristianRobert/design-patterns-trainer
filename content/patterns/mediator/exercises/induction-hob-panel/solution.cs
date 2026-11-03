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

// Builds the four cooking zones, the extractor hood and the child lock, gives each of them itself, and holds the rules.
public class Hob
{
    private readonly List<CookingZone> zones = [];

    public IReadOnlyList<CookingZone> Zones => zones;
    public ExtractorHood Hood { get; } = new();
    public ChildLock Lock { get; }

    public Hob()
    {
        for (var i = 0; i < 4; i++) zones.Add(new CookingZone(this));
        Lock = new ChildLock(this);
    }

    // Called by a zone or the lock after it changed.
    public void Changed(object part)
    {
        if (Lock.IsOn)
            foreach (var zone in zones) zone.Switch(0);
        else if (part is CookingZone changed && changed.Level == 9)
            foreach (var zone in zones)
                if (zone != changed && zone.Level == 9) zone.Switch(8);

        Hood.Run(Math.Min(3, zones.Count(z => z.Level > 0)));
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

// The child lock button.
public class ChildLock(Hob hob)
{
    public bool IsOn { get; private set; }

    public void Press()
    {
        IsOn = !IsOn;
        hob.Changed(this);
    }
}

// The extractor hood above the hob. Its speed is set for it: 0 is off, 3 is the fastest.
public class ExtractorHood
{
    public int Speed { get; private set; }

    public void Run(int speed) => Speed = speed;
}
