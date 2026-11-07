foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var camera = new Camera();
        var lines = new List<string>();
        void Show() => lines.Add($"{camera.Mode.Setting} f/{camera.Aperture.FNumber} 1/{camera.Shutter.Speed}");

        Show();
        camera.Aperture.Turn(4);
        Show();
        camera.Mode.Turn("auto");
        Show();
        camera.Aperture.Turn(16);
        Show();
        camera.Shutter.Turn(1000);
        Show();
        camera.Mode.Turn("manual");
        camera.Aperture.Turn(2);
        Show();
        return lines;
    }
}

// Builds the dials and wires each of them to the ones it changes.
public class Camera
{
    public ModeDial Mode { get; } = new();
    public ApertureRing Aperture { get; } = new();
    public ShutterDial Shutter { get; } = new();

    public Camera()
    {
        Mode.Aperture = Aperture;
        Mode.Shutter = Shutter;
        Aperture.Mode = Mode;
        Aperture.Shutter = Shutter;
    }
}

// "manual" or "auto". Switching to auto sets the shutter to match the aperture.
public class ModeDial
{
    public ApertureRing Aperture = null!;
    public ShutterDial Shutter = null!;

    public string Setting { get; private set; } = "manual";

    public void Turn(string setting)
    {
        Setting = setting;
        if (setting == "auto") Shutter.Turn(2000 / Aperture.FNumber);
    }
}

// The f-number: 2, 4, 8 or 16. In auto, turning it sets the shutter to match.
public class ApertureRing
{
    public ModeDial Mode = null!;
    public ShutterDial Shutter = null!;

    public int FNumber { get; private set; } = 8;

    public void Turn(int fNumber)
    {
        FNumber = fNumber;
        if (Mode.Setting == "auto") Shutter.Turn(2000 / FNumber);
    }
}

// The shutter speed: 1/Speed of a second. It only ever moves itself.
public class ShutterDial
{
    public int Speed { get; private set; } = 250;

    public void Turn(int speed) => Speed = speed;
}
