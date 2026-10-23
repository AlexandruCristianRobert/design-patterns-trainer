foreach (var line in Demo.Run())
    Console.WriteLine(line);
Console.WriteLine($"Catalogue file read {StarFile.Reads} times");

public static class Demo
{
    public static List<string> Run()
    {
        var dome = new DomeShow();
        var kiosk = new LobbyKiosk();
        return
        [
            dome.Open("Vega"),
            kiosk.Lookup("Sirius"),
            kiosk.Lookup("Rigel"),
            dome.Open("Polaris"),
        ];
    }
}

// The star catalogue file. Reading it is slow. Leave this class as it is.
public static class StarFile
{
    public static int Reads { get; private set; }

    public static Dictionary<string, int> Load()
    {
        Reads++;
        return new() { ["Sirius"] = 9, ["Vega"] = 25, ["Polaris"] = 433 };
    }
}

// The whole planetarium shares this one catalogue, so the file is read once.
public sealed class StarCatalogue
{
    private static readonly StarCatalogue instance = new();

    public static StarCatalogue Instance => instance;

    private readonly Dictionary<string, int> distances = StarFile.Load();

    private StarCatalogue() { }

    public string Describe(string star) =>
        distances.TryGetValue(star, out var years) ? $"{star}: {years} light years" : $"{star}: not in the catalogue";
}

public class DomeShow
{
    public string Open(string star) => $"Dome show | {StarCatalogue.Instance.Describe(star)}";
}

public class LobbyKiosk
{
    public string Lookup(string star) => $"Kiosk | {StarCatalogue.Instance.Describe(star)}";
}
