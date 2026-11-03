var treadmill = new Treadmill();
treadmill.Programs.Choose("hill");
Console.WriteLine(treadmill.Display.Text);
treadmill.Incline.Down();
Console.WriteLine(treadmill.Display.Text);
treadmill.Key.Pull();
Console.WriteLine(treadmill.Display.Text);

// Builds the controls, gives each of them itself, and holds every rule about who reacts.
public class Treadmill
{
    public SpeedControl Speed { get; }
    public InclineControl Incline { get; }
    public SafetyKey Key { get; }
    public ProgramButtons Programs { get; }
    public Display Display { get; } = new();

    public Treadmill()
    {
        Speed = new(this);
        Incline = new(this);
        Key = new(this);
        Programs = new(this);
        Show();
    }

    public void Changed(object control)
    {
        if (!Key.IsIn)
        {
            Speed.Set(0);
            Incline.Set(0);
            Programs.Set("none");
        }
        else if (control == Programs)
        {
            if (Programs.Chosen == "hill")
            {
                Incline.Set(6);
                Speed.Set(8);
            }
            else if (Programs.Chosen == "flat") Incline.Set(0);
        }
        else if (control == Incline) Programs.Set("none");
        Show();
    }

    private void Show() => Display.Show($"{Speed.Kmh} km/h, {Incline.Percent}%, {Programs.Chosen}");
}

public class SpeedControl(Treadmill treadmill)
{
    public int Kmh { get; private set; }

    public void Up() => Move(1);
    public void Down() => Move(-1);

    private void Move(int by)
    {
        Set(Kmh + by);
        treadmill.Changed(this);
    }

    // Used by the treadmill.
    public void Set(int kmh) => Kmh = Math.Clamp(kmh, 0, 20);
}

public class InclineControl(Treadmill treadmill)
{
    public int Percent { get; private set; }

    public void Up() => Move(1);
    public void Down() => Move(-1);

    private void Move(int by)
    {
        Set(Percent + by);
        treadmill.Changed(this);
    }

    // Used by the treadmill.
    public void Set(int percent) => Percent = Math.Clamp(percent, 0, 10);
}

public class SafetyKey(Treadmill treadmill)
{
    public bool IsIn { get; private set; } = true;

    public void Pull()
    {
        IsIn = false;
        treadmill.Changed(this);
    }

    public void Insert()
    {
        IsIn = true;
        treadmill.Changed(this);
    }
}

public class ProgramButtons(Treadmill treadmill)
{
    public string Chosen { get; private set; } = "none";

    public void Choose(string name)
    {
        Chosen = name;
        treadmill.Changed(this);
    }

    // Used by the treadmill.
    public void Set(string name) => Chosen = name;
}

public class Display
{
    public string Text { get; private set; } = "";

    public void Show(string text) => Text = text;
}
