foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var camera = new Camera();
        var lines = new List<string> { camera.Viewfinder.Text };
        camera.Aperture.Turn(-1);
        lines.Add(camera.Viewfinder.Text);
        camera.Mode.Turn("auto");
        lines.Add(camera.Viewfinder.Text);
        camera.Aperture.Turn(2);
        lines.Add(camera.Viewfinder.Text);
        camera.Shutter.Turn(3);
        lines.Add(camera.Viewfinder.Text);
        camera.Mode.Turn("manual");
        camera.Shutter.Turn(-1);
        lines.Add(camera.Viewfinder.Text);
        return lines;
    }
}

// Builds the dials and wires each of them to the ones it changes.
public class Camera
{
    public ModeDial Mode { get; } = new();
    public ApertureRing Aperture { get; } = new();
    public ShutterDial Shutter { get; } = new();
    public Viewfinder Viewfinder { get; } = new();

    public Camera()
    {
        Mode.Aperture = Aperture;
        Mode.Shutter = Shutter;
        Mode.Viewfinder = Viewfinder;
        Aperture.Mode = Mode;
        Aperture.Shutter = Shutter;
        Aperture.Viewfinder = Viewfinder;
        Shutter.Mode = Mode;
        Shutter.Aperture = Aperture;
        Shutter.Viewfinder = Viewfinder;
        Viewfinder.Show(Mode.Setting, Aperture.FNumber, Shutter.Speed);
    }
}

// "manual" or "auto". Switching to auto sets the shutter to match the aperture.
public class ModeDial
{
    public ApertureRing Aperture = null!;
    public ShutterDial Shutter = null!;
    public Viewfinder Viewfinder = null!;

    public string Setting { get; private set; } = "manual";

    public void Turn(string setting)
    {
        Setting = setting;
        if (setting == "auto") Shutter.Index = 4 - Aperture.Index;
        Viewfinder.Show(Setting, Aperture.FNumber, Shutter.Speed);
    }
}

// The f-number: 2, 4, 8 or 16. In auto, turning it sets the shutter to match.
public class ApertureRing
{
    public static readonly int[] FNumbers = [2, 4, 8, 16];

    public ModeDial Mode = null!;
    public ShutterDial Shutter = null!;
    public Viewfinder Viewfinder = null!;

    public int Index { get; set; } = 2;
    public int FNumber => FNumbers[Index];

    public void Turn(int clicks)
    {
        Index = Math.Clamp(Index + clicks, 0, FNumbers.Length - 1);
        if (Mode.Setting == "auto") Shutter.Index = 4 - Index;
        Viewfinder.Show(Mode.Setting, FNumber, Shutter.Speed);
    }
}

// The shutter speed, 1/60 to 1/1000 of a second. In auto, turning it sets the aperture to match.
public class ShutterDial
{
    public static readonly int[] Speeds = [60, 125, 250, 500, 1000];

    public ModeDial Mode = null!;
    public ApertureRing Aperture = null!;
    public Viewfinder Viewfinder = null!;

    public int Index { get; set; } = 2;
    public int Speed => Speeds[Index];

    public void Turn(int clicks)
    {
        Index = Math.Clamp(Index + clicks, 0, Speeds.Length - 1);
        if (Mode.Setting == "auto") Aperture.Index = Math.Min(4 - Index, 3);
        Viewfinder.Show(Mode.Setting, Aperture.FNumber, Speed);
    }
}

// Shows the settings, such as "auto f/8 1/250".
public class Viewfinder
{
    public string Text { get; private set; } = "";

    public void Show(string setting, int fNumber, int speed) => Text = $"{setting} f/{fNumber} 1/{speed}";
}
