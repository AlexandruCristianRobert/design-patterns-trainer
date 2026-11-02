foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run() =>
    [
        new DelayOnSpeakers("9:15 to York", 10).Announce(),
        new DelayOnScreen("9:15 to York", 10).Announce(),
        new PlatformChangeOnSpeakers("10:02 to Leeds", 4).Announce(),
        new PlatformChangeOnScreen("10:02 to Leeds", 4).Announce(),
    ];
}

// One class for every kind of announcement on every way of giving it out.
// A new kind of announcement, or a new way to give one out, means a new class for each pairing.
public class DelayOnSpeakers(string train, int minutes)
{
    public string Announce() => $"Ding dong. {train}: delayed by {minutes} minutes.";
}

public class DelayOnScreen(string train, int minutes)
{
    public string Announce() => $"{train.ToUpperInvariant()} | delayed by {minutes} minutes";
}

public class PlatformChangeOnSpeakers(string train, int platform)
{
    public string Announce() => $"Ding dong. {train}: now leaving from platform {platform}.";
}

public class PlatformChangeOnScreen(string train, int platform)
{
    public string Announce() => $"{train.ToUpperInvariant()} | now leaving from platform {platform}";
}
