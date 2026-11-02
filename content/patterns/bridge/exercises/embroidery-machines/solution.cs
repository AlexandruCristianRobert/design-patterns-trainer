foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var home = new HomeMachine();
        var studio = new StudioMachine();
        return
        [
            .. new Monogram(home, "AB").Stitch(),
            .. new Badge(studio, 2).Stitch(),
            .. new Monogram(studio, "Z").Stitch(),
        ];
    }
}

// The stitches every embroidery machine can sew, each machine in its own way.
public abstract class Machine
{
    public abstract string Satin(string text);
    public abstract string Fill(string shape);
}

public class HomeMachine : Machine
{
    public override string Satin(string text) => $"satin stitch \"{text}\"";
    public override string Fill(string shape) => $"fill stitch {shape}";
}

public class StudioMachine : Machine
{
    public override string Satin(string text) => $"SAT {text}";
    public override string Fill(string shape) => $"FIL {shape}";
}

// A design holds the machine it is sewn on and decides only which stitches it needs.
public abstract class Design(Machine machine)
{
    protected Machine Machine => machine;

    public abstract List<string> Stitch();
}

public class Monogram(Machine machine, string letters) : Design(machine)
{
    public override List<string> Stitch() => [Machine.Fill("circle"), Machine.Satin(letters)];
}

public class Badge(Machine machine, int stars) : Design(machine)
{
    public override List<string> Stitch()
    {
        var steps = new List<string> { Machine.Fill("shield") };
        for (var i = 0; i < stars; i++)
            steps.Add(Machine.Fill("star"));
        return steps;
    }
}
