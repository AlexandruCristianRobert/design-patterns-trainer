Resort alps = new AlpineResort();
Console.WriteLine(alps.Sell("Ana", 3));
Console.WriteLine(alps.Sell("Radu", 1));

Resort north = new NordicResort();
Console.WriteLine(north.Sell("Zoe", 2));
Console.WriteLine($"sold: {alps.Sold} in the Alps, {north.Sold} up north");

public interface ISkiPass
{
    string Print(string skier, int days);
}

public class AlpinePass : ISkiPass
{
    public string Print(string skier, int days) => $"ALPINE | {skier} | {days} days | chip card";
}

public class NordicPass : ISkiPass
{
    public string Print(string skier, int days) => $"NORDIC | {skier} | {days} days | paper ticket";
}

public abstract class Resort
{
    public int Sold { get; private set; }

    // Each resort decides which pass it hands out.
    protected abstract ISkiPass NewPass();

    public string Sell(string skier, int days)
    {
        var pass = NewPass();
        Sold++;
        return $"{pass.Print(skier, days)} | {days * 45} EUR";
    }
}

public class AlpineResort : Resort
{
    protected override ISkiPass NewPass() => new AlpinePass();
}

public class NordicResort : Resort
{
    protected override ISkiPass NewPass() => new NordicPass();
}
