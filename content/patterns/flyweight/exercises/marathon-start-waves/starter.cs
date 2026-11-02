foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Runner[] runners =
        [
            new Runner(101, "Ana", "elite"),
            new Runner(102, "Bo", "elite"),
            new Runner(2040, "Cy", "club"),
            new Runner(5311, "Dee", "fun"),
        ];
        return runners.Select(r => r.Label()).ToList();
    }
}

// One of the 20,000 runners in a city marathon. There are only four start waves,
// but every runner keeps its own copy of everything about its wave.
public class Runner
{
    private readonly int bib;
    private readonly string name;
    private readonly string wave;
    private readonly string colour;
    private readonly string start;

    public Runner(int bib, string name, string wave)
    {
        this.bib = bib;
        this.name = name;
        this.wave = wave;
        (colour, start) = wave switch
        {
            "elite" => ("red", "08:30"),
            "fast" => ("blue", "08:45"),
            "club" => ("green", "09:00"),
            "fun" => ("yellow", "09:20"),
            _ => throw new ArgumentException($"No wave called {wave}."),
        };
    }

    public string Label() => $"Bib {bib} {name}: {wave} wave, {colour}, starts {start}";
}
