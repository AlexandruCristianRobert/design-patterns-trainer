foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run() =>
    [
        new GreenTeaCounter().Serve(2),
        new BlackTeaCounter().Serve(3),
    ];
}

public interface ITeaPot
{
    string Tea { get; }

    // How long this pot steeps.
    int Minutes { get; }
}

public class GreenTeaPot : ITeaPot
{
    public string Tea => "green tea";
    public int Minutes => 2;
}

public class BlackTeaPot : ITeaPot
{
    public string Tea => "black tea";
    public int Minutes => 4;
}

public abstract class TeaCounter
{
    public abstract string Serve(int cups);
}

public class GreenTeaCounter : TeaCounter
{
    public override string Serve(int cups)
    {
        var lines = new List<string>();
        var minutes = 0;
        for (var cup = 1; cup <= cups; cup++)
        {
            var pot = new GreenTeaPot();
            lines.Add($"cup {cup}: {pot.Tea}");
            minutes += pot.Minutes;
        }
        return $"{string.Join(", ", lines)} ({minutes} min)";
    }
}

// The same steps again. Only the pot is different.
public class BlackTeaCounter : TeaCounter
{
    public override string Serve(int cups)
    {
        var lines = new List<string>();
        var minutes = 0;
        for (var cup = 1; cup <= cups; cup++)
        {
            var pot = new BlackTeaPot();
            lines.Add($"cup {cup}: {pot.Tea}");
            minutes += pot.Minutes;
        }
        return $"{string.Join(", ", lines)} ({minutes} min)";
    }
}
