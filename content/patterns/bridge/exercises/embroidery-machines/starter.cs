foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run() =>
    [
        .. new Monogram("home", "AB").Stitch(),
        .. new Badge("studio", 2).Stitch(),
        .. new Monogram("studio", "Z").Stitch(),
    ];
}

// Every design is told the machine's name, and each kind of stitch has its own switch over it.
// A new machine means editing every switch.
public abstract class Design(string machine)
{
    protected string Satin(string text) => machine switch
    {
        "home" => $"satin stitch \"{text}\"",
        "studio" => $"SAT {text}",
        _ => throw new ArgumentException($"unknown machine: {machine}"),
    };

    protected string Fill(string shape) => machine switch
    {
        "home" => $"fill stitch {shape}",
        "studio" => $"FIL {shape}",
        _ => throw new ArgumentException($"unknown machine: {machine}"),
    };

    public abstract List<string> Stitch();
}

public class Monogram(string machine, string letters) : Design(machine)
{
    public override List<string> Stitch() => [Fill("circle"), Satin(letters)];
}

public class Badge(string machine, int stars) : Design(machine)
{
    public override List<string> Stitch()
    {
        var steps = new List<string> { Fill("shield") };
        for (var i = 0; i < stars; i++)
            steps.Add(Fill("star"));
        return steps;
    }
}
