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

// Builds the dials, gives itself to the ones that report a turn, and holds the rule about which dial follows.
public class Camera
{
    public ModeDial Mode { get; }
    public ApertureRing Aperture { get; }
    public ShutterDial Shutter { get; } = new();

    public Camera()
    {
        Mode = new(this);
        Aperture = new(this);
    }

    // Called by the mode dial or the aperture ring after it was turned.
    public void Turned()
    {
        if (Mode.Setting == "auto") Shutter.Turn(2000 / Aperture.FNumber);
    }
}

// "manual" or "auto".
public class ModeDial(Camera camera)
{
    public string Setting { get; private set; } = "manual";

    public void Turn(string setting)
    {
        Setting = setting;
        camera.Turned();
    }
}

// The f-number: 2, 4, 8 or 16.
public class ApertureRing(Camera camera)
{
    public int FNumber { get; private set; } = 8;

    public void Turn(int fNumber)
    {
        FNumber = fNumber;
        camera.Turned();
    }
}

// The shutter speed: 1/Speed of a second. It only ever moves itself.
public class ShutterDial
{
    public int Speed { get; private set; } = 250;

    public void Turn(int speed) => Speed = speed;
}
