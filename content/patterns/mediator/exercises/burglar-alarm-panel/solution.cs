var alarm = new AlarmPanel();
alarm.Keypad.Arm();
alarm.FrontDoor.Open();
Console.WriteLine($"armed and the door opened, siren: {alarm.Siren.IsSounding}");
alarm.Keypad.Disarm();
Console.WriteLine($"disarmed, siren: {alarm.Siren.IsSounding}");

// What the parts talk to. A part calls Changed with itself after something happened to it.
public interface IAlarm
{
    void Changed(object part);
}

// Builds the parts, gives itself to the ones that report a change, and holds the rules about who reacts.
public class AlarmPanel : IAlarm
{
    public Keypad Keypad { get; }
    public DoorSensor FrontDoor { get; }
    public Siren Siren { get; } = new();

    public AlarmPanel()
    {
        Keypad = new(this);
        FrontDoor = new(this);
    }

    public void Changed(object part)
    {
        if (part == FrontDoor && Keypad.IsArmed) Siren.Sound(true);
        if (part == Keypad && !Keypad.IsArmed) Siren.Sound(false);
    }
}

public class Keypad(IAlarm alarm)
{
    public bool IsArmed { get; private set; }

    public void Arm()
    {
        IsArmed = true;
        alarm.Changed(this);
    }

    public void Disarm()
    {
        IsArmed = false;
        alarm.Changed(this);
    }
}

public class DoorSensor(IAlarm alarm)
{
    public void Open() => alarm.Changed(this);
}

// Sounds only when the panel tells it to.
public class Siren
{
    public bool IsSounding { get; private set; }

    public void Sound(bool on) => IsSounding = on;
}
