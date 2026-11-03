var alarm = new AlarmPanel("2580");
alarm.Keypad.Enter("2580");
Console.WriteLine($"{alarm.Keypad.Display}, armed: {alarm.IsArmed}");
alarm.FrontDoor.Open();
Console.WriteLine($"door open, siren: {alarm.Siren.IsSounding}, light: {alarm.Light.IsOn}");
alarm.Keypad.Enter("2580");
Console.WriteLine($"{alarm.Keypad.Display}, siren: {alarm.Siren.IsSounding}");

// What every part talks to. A part calls Changed with itself after something happened to it.
public interface IAlarm
{
    void Changed(object part);
}

// Builds the parts, gives each of them itself, and holds every rule about who reacts.
public class AlarmPanel : IAlarm
{
    private readonly string code;
    private int wrongInARow;

    public bool IsArmed { get; private set; }
    public Keypad Keypad { get; }
    public DoorSensor FrontDoor { get; }
    public MotionSensor Hallway { get; }
    public Siren Siren { get; } = new();
    public HallLight Light { get; } = new();

    public AlarmPanel(string code)
    {
        this.code = code;
        Keypad = new(this);
        FrontDoor = new(this);
        Hallway = new(this);
    }

    public void Changed(object part)
    {
        if (part == Keypad) Entered(Keypad.Entered);
        else if (part == FrontDoor && FrontDoor.IsOpen)
        {
            Light.Switch(true);
            if (IsArmed) Siren.Sound(true);
        }
        else if (part == Hallway)
        {
            if (IsArmed) Siren.Sound(true);
            else Light.Switch(true);
        }
    }

    private void Entered(string entered)
    {
        if (entered != code)
        {
            Keypad.Show("wrong code");
            if (++wrongInARow == 3) Siren.Sound(true);
            return;
        }

        wrongInARow = 0;
        if (IsArmed || Siren.IsSounding)
        {
            IsArmed = false;
            Siren.Sound(false);
            Keypad.Show("off");
        }
        else if (FrontDoor.IsOpen) Keypad.Show("close the door");
        else
        {
            IsArmed = true;
            Light.Switch(false);
            Keypad.Show("armed");
        }
    }
}

public class Keypad(IAlarm alarm)
{
    public string Display { get; private set; } = "off";
    public string Entered { get; private set; } = "";

    public void Enter(string code)
    {
        Entered = code;
        alarm.Changed(this);
    }

    // Used by the panel.
    public void Show(string text) => Display = text;
}

public class DoorSensor(IAlarm alarm)
{
    public bool IsOpen { get; private set; }

    public void Open()
    {
        IsOpen = true;
        alarm.Changed(this);
    }

    public void Close()
    {
        IsOpen = false;
        alarm.Changed(this);
    }
}

public class MotionSensor(IAlarm alarm)
{
    public void Detect() => alarm.Changed(this);
}

// Sounds only when it is told to.
public class Siren
{
    public bool IsSounding { get; private set; }

    public void Sound(bool on) => IsSounding = on;
}

// Turns on and off only when it is told to.
public class HallLight
{
    public bool IsOn { get; private set; }

    public void Switch(bool on) => IsOn = on;
}
