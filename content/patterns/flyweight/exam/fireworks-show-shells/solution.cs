var rack = new ShellRack();
var show = new Show(rack);
show.Launch(65, 2, "willow");
show.Launch(5, 3, "peony");
show.Launch(5, 1, "crossette");

foreach (var line in show.Script())
    Console.WriteLine(line);
Console.WriteLine($"Shells created: {rack.Created}");

// What every burst of one kind of shell has in common. It never changes, so all those bursts share it.
public sealed class Shell(string name, string colour, int metres)
{
    public string Name { get; } = name;
    public string Colour { get; } = colour;
    public int Metres { get; } = metres;

    public string Line(int second, int pad) => $"{second / 60}:{second % 60:00} pad {pad}: {Colour} {Name}, {Metres} m";
}

// Hands out one Shell per name, and creates it only the first time that name is asked for.
public class ShellRack
{
    private readonly Dictionary<string, Shell> made = new();

    public int Created => made.Count;

    public Shell Get(string name)
    {
        if (made.TryGetValue(name, out var shell)) return shell;
        shell = name switch
        {
            "peony" => new Shell("peony", "red", 120),
            "willow" => new Shell("willow", "gold", 150),
            "crossette" => new Shell("crossette", "green", 90),
            _ => throw new ArgumentException($"No shell called {name}."),
        };
        made[name] = shell;
        return shell;
    }
}

// The show keeps, for each launch, only its time, its pad and a reference to the shared shell.
public class Show(ShellRack rack)
{
    private readonly List<(int Second, int Pad, Shell Shell)> launches = [];

    public void Launch(int second, int pad, string shell) => launches.Add((second, pad, rack.Get(shell)));

    public Shell ShellAt(int index) => launches[index].Shell;

    public List<string> Script() =>
        launches.OrderBy(l => l.Second).Select(l => l.Shell.Line(l.Second, l.Pad)).ToList();
}
