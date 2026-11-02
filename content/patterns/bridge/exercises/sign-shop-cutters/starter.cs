foreach (var step in new SquareSign(new LaserCutter(), 40).Cut())
    Console.WriteLine($"square on laser: {step}");

foreach (var step in new ArrowSign(new VinylPlotter(), 60).Cut())
    Console.WriteLine($"arrow on plotter: {step}");

// The small steps every cutting machine can do. Leave this interface as it is.
public interface ICutter
{
    string Straight(int cm);
    string Circle(int cm);
}

public class LaserCutter : ICutter
{
    public string Straight(int cm) => $"laser straight {cm} cm";
    public string Circle(int cm) => $"laser circle {cm} cm";
}

public class VinylPlotter : ICutter
{
    // TODO: the plotter works in millimetres: "plot straight 400 mm", "plot circle 250 mm".
    public string Straight(int cm) => throw new NotImplementedException();
    public string Circle(int cm) => throw new NotImplementedException();
}

// A sign holds the machine it is cut on, and makes its shape from that machine's steps.
public abstract class Sign(ICutter cutter)
{
    protected ICutter Cutter => cutter;

    public abstract List<string> Cut();
}

public class SquareSign(ICutter cutter, int side) : Sign(cutter)
{
    public override List<string> Cut() =>
        [Cutter.Straight(side), Cutter.Straight(side), Cutter.Straight(side), Cutter.Straight(side)];
}

public class RoundSign(ICutter cutter, int diameter) : Sign(cutter)
{
    public override List<string> Cut() => [Cutter.Circle(diameter)];
}

public class ArrowSign(ICutter cutter, int length) : Sign(cutter)
{
    // TODO: one straight cut of the full length for the shaft, then two straight cuts of half the length for the head.
    public override List<string> Cut() => [];
}
