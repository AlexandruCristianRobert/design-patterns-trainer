foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var speakers = new Speakers();
        var screen = new InfoScreen();
        return
        [
            new Delay(speakers, "9:15 to York", 10).Announce(),
            new Delay(screen, "9:15 to York", 10).Announce(),
            new PlatformChange(speakers, "10:02 to Leeds", 4).Announce(),
            new PlatformChange(screen, "10:02 to Leeds", 4).Announce(),
        ];
    }
}

// One way of giving out an announcement. Each channel only knows how to present a headline and a detail.
public abstract class Channel
{
    public abstract string Present(string headline, string detail);
}

public class Speakers : Channel
{
    public override string Present(string headline, string detail) => $"Ding dong. {headline}: {detail}.";
}

public class InfoScreen : Channel
{
    public override string Present(string headline, string detail) => $"{headline.ToUpperInvariant()} | {detail}";
}

// One kind of announcement. It holds the channel it goes out on and only decides what to say.
public abstract class Announcement(Channel channel)
{
    protected Channel Output => channel;

    public abstract string Announce();
}

public class Delay(Channel channel, string train, int minutes) : Announcement(channel)
{
    public override string Announce() => Output.Present(train, $"delayed by {minutes} minutes");
}

public class PlatformChange(Channel channel, string train, int platform) : Announcement(channel)
{
    public override string Announce() => Output.Present(train, $"now leaving from platform {platform}");
}
