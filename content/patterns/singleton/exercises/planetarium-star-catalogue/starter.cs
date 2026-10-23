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

// Every new catalogue reads the whole file again.
public class StarCatalogue
{
    private readonly Dictionary<string, int> distances = StarFile.Load();

    public string Describe(string star) =>
        distances.TryGetValue(star, out var years) ? $"{star}: {years} light years" : $"{star}: not in the catalogue";
}

public class DomeShow
{
    public string Open(string star) => $"Dome show | {new StarCatalogue().Describe(star)}";
}

public class LobbyKiosk
{
    public string Lookup(string star) => $"Kiosk | {new StarCatalogue().Describe(star)}";
}
