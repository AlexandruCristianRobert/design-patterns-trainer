foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var waves = new Waves();
        Runner[] runners =
        [
            new Runner(101, "Ana", waves.Get("elite")),
            new Runner(102, "Bo", waves.Get("elite")),
            new Runner(2040, "Cy", waves.Get("club")),
            new Runner(5311, "Dee", waves.Get("fun")),
        ];
        return runners.Select(r => r.Label()).ToList();
    }
}

// Everything the runners of one start wave have in common. It never changes, so they all share it.
public sealed class Wave(string name, string colour, string start)
{
    public string Name { get; } = name;
    public string Colour { get; } = colour;
    public string Start { get; } = start;
}

// Hands out one Wave per name, and creates it only the first time that name is asked for.
public class Waves
{
    private readonly Dictionary<string, Wave> made = new();

    public Wave Get(string name)
    {
        if (made.TryGetValue(name, out var wave)) return wave;
        var (colour, start) = name switch
        {
            "elite" => ("red", "08:30"),
            "fast" => ("blue", "08:45"),
            "club" => ("green", "09:00"),
            "fun" => ("yellow", "09:20"),
            _ => throw new ArgumentException($"No wave called {name}."),
        };
        wave = new Wave(name, colour, start);
        made[name] = wave;
        return wave;
    }
}

// A runner keeps only what is its own, and a reference to the wave it shares with the others.
public class Runner(int bib, string name, Wave wave)
{
    private readonly int bib = bib;
    private readonly string name = name;
    private readonly Wave wave = wave;

    public string Label() => $"Bib {bib} {name}: {wave.Name} wave, {wave.Colour}, starts {wave.Start}";
}
