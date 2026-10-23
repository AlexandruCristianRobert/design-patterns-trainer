var vacuum = new RobotVacuum(new QuietMode());
Console.WriteLine($"bedroom: {vacuum.Clean(12)} min");

// The owner picks another mode in the app; the vacuum never picks one itself.
vacuum.Mode = new TurboMode();
Console.WriteLine($"living room: {vacuum.Clean(30)} min");

vacuum.Mode = new SpotMode();
Console.WriteLine($"spilled cereal: {vacuum.Clean(2)} min");
Console.WriteLine($"total: {vacuum.TotalMinutes} min");

public interface CleaningMode
{
    int MinutesFor(int squareMeters);
}

public class RobotVacuum(CleaningMode mode)
{
    public CleaningMode Mode { get; set; } = mode;

    public int TotalMinutes { get; private set; }

    public int Clean(int squareMeters)
    {
        var minutes = Mode.MinutesFor(squareMeters);
        TotalMinutes += minutes;
        return minutes;
    }
}

public class QuietMode : CleaningMode
{
    public int MinutesFor(int squareMeters) => 3 * squareMeters;
}

public class TurboMode : CleaningMode
{
    public int MinutesFor(int squareMeters) => squareMeters;
}

public class SpotMode : CleaningMode
{
    public int MinutesFor(int squareMeters) => 5;
}
