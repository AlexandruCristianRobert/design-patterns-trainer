var voice = new VoiceAssistant();
var panel = new WallPanel();
Console.WriteLine(panel.Show("kitchen"));
Console.WriteLine(voice.Heat(22));
Console.WriteLine(voice.Lights("kitchen", true));
Console.WriteLine(panel.Show("kitchen"));

public sealed class HomeHub
{
    private static readonly Lazy<HomeHub> hub = new(() => new HomeHub(), LazyThreadSafetyMode.ExecutionAndPublication);

    public static HomeHub Main => hub.Value;

    private readonly HashSet<string> lit = [];

    private HomeHub() { }

    public int Heating { get; private set; } = 20;

    public void SetHeating(int degrees) => Heating = degrees;

    public void SetLights(string room, bool on)
    {
        if (on) lit.Add(room);
        else lit.Remove(room);
    }

    public string Room(string room) => $"{room}: lights {(lit.Contains(room) ? "on" : "off")}, heating {Heating}";
}

public class WallPanel
{
    public string Show(string room) => $"Panel | {HomeHub.Main.Room(room)}";
}

public class VoiceAssistant
{
    public string Heat(int degrees)
    {
        HomeHub.Main.SetHeating(degrees);
        return $"Heating set to {degrees}";
    }

    public string Lights(string room, bool on)
    {
        HomeHub.Main.SetLights(room, on);
        return $"Lights in {room} {(on ? "on" : "off")}";
    }
}
