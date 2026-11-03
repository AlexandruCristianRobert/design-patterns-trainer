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

// What every dial talks to. A dial calls Changed with itself after the user turns it.
public interface ICameraBody
{
    void Changed(object dial);
}

// Builds the dials, gives each of them itself, and holds the rules about who reacts.
public class Camera : ICameraBody
{
    public ModeDial Mode { get; }
    public ApertureRing Aperture { get; }
    public ShutterDial Shutter { get; }
    public Viewfinder Viewfinder { get; } = new();

    public Camera()
    {
        Mode = new(this);
        Aperture = new(this);
        Shutter = new(this);
        Show();
    }

    public void Changed(object dial)
    {
        if (Mode.Setting == "auto")
        {
            // A wider aperture lets in more light, so the shutter is one step faster for each step, and the other way round.
            if (dial == Mode || dial == Aperture) Shutter.Set(4 - Aperture.Index);
            else if (dial == Shutter) Aperture.Set(Math.Min(4 - Shutter.Index, 3));
        }
        Show();
    }

    private void Show() => Viewfinder.Show(Mode.Setting, Aperture.FNumber, Shutter.Speed);
}

// "manual" or "auto".
public class ModeDial(ICameraBody camera)
{
    public string Setting { get; private set; } = "manual";

    public void Turn(string setting)
    {
        Setting = setting;
        camera.Changed(this);
    }
}

// The f-number: 2, 4, 8 or 16.
public class ApertureRing(ICameraBody camera)
{
    private static readonly int[] FNumbers = [2, 4, 8, 16];

    public int Index { get; private set; } = 2;
    public int FNumber => FNumbers[Index];

    public void Turn(int clicks)
    {
        Set(Index + clicks);
        camera.Changed(this);
    }

    // Used by the camera: moves the ring without telling anyone.
    public void Set(int index) => Index = Math.Clamp(index, 0, FNumbers.Length - 1);
}

// The shutter speed, 1/60 to 1/1000 of a second.
public class ShutterDial(ICameraBody camera)
{
    private static readonly int[] Speeds = [60, 125, 250, 500, 1000];

    public int Index { get; private set; } = 2;
    public int Speed => Speeds[Index];

    public void Turn(int clicks)
    {
        Set(Index + clicks);
        camera.Changed(this);
    }

    // Used by the camera: moves the dial without telling anyone.
    public void Set(int index) => Index = Math.Clamp(index, 0, Speeds.Length - 1);
}

// Shows the settings, such as "auto f/8 1/250".
public class Viewfinder
{
    public string Text { get; private set; } = "";

    public void Show(string setting, int fNumber, int speed) => Text = $"{setting} f/{fNumber} 1/{speed}";
}
