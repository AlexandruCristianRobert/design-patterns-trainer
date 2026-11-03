var desk = new Desk();
var buttons = new PresetButtons();
desk.SetHeight(110);
desk.SetMonitor(0, 20);
desk.SetLamp(true);
buttons.Store(1, desk.Save());
desk.SetHeight(72);
desk.SetMonitor(0, 5);
Console.WriteLine($"sitting:  {desk.Show()}");
desk.Restore(buttons.Recall(1)!);
Console.WriteLine($"standing: {desk.Show()}");

// What a preset button keeps. It is empty, so the buttons can hold a position but not read it.
public interface IDeskPosition
{
}

// An electric desk with two monitor arms and a lamp.
public class Desk
{
    private int height = 72;
    private readonly int[] monitors = [0, 0];
    private bool lamp;

    public void SetHeight(int cm) => height = Math.Clamp(cm, 65, 125);

    public void SetMonitor(int monitor, int cm) => monitors[monitor] = Math.Clamp(cm, 0, 40);

    public void SetLamp(bool on) => lamp = on;

    public string Show() => $"desk {height} cm, monitors {monitors[0]}/{monitors[1]} cm, lamp {(lamp ? "on" : "off")}";

    // The monitor heights go into a new array, so later changes do not reach the position.
    public IDeskPosition Save() => new Position(height, [.. monitors], lamp);

    public void Restore(IDeskPosition position)
    {
        var saved = (Position)position;
        height = saved.Height;
        saved.Monitors.CopyTo(monitors, 0);
        lamp = saved.Lamp;
    }

    private sealed record Position(int Height, int[] Monitors, bool Lamp) : IDeskPosition;
}

// Four buttons, each keeping one position, without reading it.
public class PresetButtons
{
    private readonly Dictionary<int, IDeskPosition> stored = [];

    public void Store(int button, IDeskPosition position) => stored[button] = position;

    public IDeskPosition? Recall(int button) => stored.GetValueOrDefault(button);
}
