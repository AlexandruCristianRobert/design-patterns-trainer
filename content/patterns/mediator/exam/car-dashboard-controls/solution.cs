var car = new Dashboard();
car.Gear.Select("D");
car.Cruise.Set(110);
Console.WriteLine($"cruise: {car.Cruise.IsOn} at {car.Cruise.Speed}");
car.Brake.Press();
Console.WriteLine($"after braking, cruise: {car.Cruise.IsOn}");
car.Gear.Select("R");
Console.WriteLine($"reversing, camera: {car.Camera.IsShowing}, radio muted: {car.Radio.IsMuted}");

// Builds the controls, gives each of them itself, and holds every rule about who reacts.
public class Dashboard
{
    public CruiseControl Cruise { get; } = new();
    public BrakePedal Brake { get; } = new();
    public GearLever Gear { get; } = new();
    public ReversingCamera Camera { get; } = new();
    public Radio Radio { get; } = new();

    public Dashboard()
    {
        Cruise.Dashboard = this;
        Brake.Dashboard = this;
        Gear.Dashboard = this;
    }

    // Asked by the cruise control before it turns on.
    public bool CanCruise() => Gear.Position == "D";

    public void Braked() => Cruise.Off();

    public void GearChanged()
    {
        if (Gear.Position != "D") Cruise.Off();
        var reversing = Gear.Position == "R";
        Camera.Show(reversing);
        Radio.Mute(reversing);
    }
}

public class CruiseControl
{
    public Dashboard Dashboard { get; set; } = null!;

    public bool IsOn { get; private set; }
    public int Speed { get; private set; }

    public void Set(int speed)
    {
        if (!Dashboard.CanCruise()) return;
        IsOn = true;
        Speed = speed;
    }

    public void Off()
    {
        IsOn = false;
        Speed = 0;
    }
}

public class BrakePedal
{
    public Dashboard Dashboard { get; set; } = null!;

    public void Press() => Dashboard.Braked();
}

public class GearLever
{
    public Dashboard Dashboard { get; set; } = null!;

    public string Position { get; private set; } = "P";

    public void Select(string position)
    {
        Position = position;
        Dashboard.GearChanged();
    }
}

public class ReversingCamera
{
    public bool IsShowing { get; private set; }

    public void Show(bool showing) => IsShowing = showing;
}

public class Radio
{
    public bool IsMuted { get; private set; }

    public void Mute(bool muted) => IsMuted = muted;
}
