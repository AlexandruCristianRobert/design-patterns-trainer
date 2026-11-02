// The log only knows IRunSource. An adapter fits the watch SDK to it.
var log = new TrainingLog(new PaceWatchAdapter(new PaceWatchSdk()));
log.PrintRuns();

// What the log expects: distances in km, durations as a TimeSpan.
public record Run(string Day, double Km, TimeSpan Duration);

public interface IRunSource
{
    IReadOnlyList<Run> GetRuns();
}

// The watch maker's SDK. It is third-party code, so it stays as it is.
public record Activity(string Day, double Miles, int Seconds);

public class PaceWatchSdk
{
    public List<Activity> FetchActivities() =>
        [new Activity("Mon", 3.1, 1800), new Activity("Wed", 6.2, 3300)];
}

// The adapter: it offers what the log expects, and translates for the SDK.
public class PaceWatchAdapter(PaceWatchSdk sdk) : IRunSource
{
    private const double KmPerMile = 1.609344;

    public IReadOnlyList<Run> GetRuns() =>
        sdk.FetchActivities()
           .Select(a => new Run(a.Day, a.Miles * KmPerMile, TimeSpan.FromSeconds(a.Seconds)))
           .ToList();
}

// The client: it knows only IRunSource.
public class TrainingLog(IRunSource source)
{
    public void PrintRuns()
    {
        foreach (var run in source.GetRuns())
            Console.WriteLine($"{run.Day}: {run.Km:F1} km in {run.Duration}");
    }
}
