var tablet = new BookingTablet(new LaneDesk(new LaneBoard(), new Till(), new ShoeCounter(), new Scoreboard()));
Console.WriteLine(tablet.Tap("Ana", ["Ana", "Bo", "Cy"]));
Console.WriteLine(tablet.Tap("Dee", ["Dee", "Eli", "Fay", "Gus", "Hal", "Ida", "Jo"]));
foreach (var line in BowlingLog.Lines)
    Console.WriteLine(line);

// Collects what the bowling alley's classes did, in order.
public static class BowlingLog
{
    public static List<string> Lines { get; } = [];
}

// Lane 4 takes groups of 1 to 3 players, lane 9 groups of 4 to 6. Any other group gets no lane (null).
public class LaneBoard
{
    public int? Reserve(int players)
    {
        int? lane = players is >= 1 and <= 3 ? 4 : players is >= 4 and <= 6 ? 9 : null;
        BowlingLog.Lines.Add(lane is null ? $"no lane for {players} players" : $"lane {lane} for {players} players");
        return lane;
    }
}

public class Till
{
    public void Charge(string group, int cents) => BowlingLog.Lines.Add($"charged {group} {cents}");
}

public class ShoeCounter
{
    public void Hand(int pairs) => BowlingLog.Lines.Add($"{pairs} pairs of shoes");
}

public class Scoreboard
{
    public void Show(int lane, string[] players) => BowlingLog.Lines.Add($"lane {lane}: {string.Join(", ", players)}");
}

// The facade: one call books a lane, running the four steps in order.
public class LaneDesk(LaneBoard lanes, Till till, ShoeCounter shoes, Scoreboard scoreboard)
{
    private const int CentsPerPlayer = 550;

    public int? Book(string group, string[] players)
    {
        var lane = lanes.Reserve(players.Length);
        if (lane is null)
            return null;
        till.Charge(group, players.Length * CentsPerPlayer);
        shoes.Hand(players.Length);
        scoreboard.Show(lane.Value, players);
        return lane;
    }
}

// The tablet at the entrance. It only knows LaneDesk.
public class BookingTablet(LaneDesk desk)
{
    public string Tap(string group, string[] players) =>
        desk.Book(group, players) is { } lane ? $"{group}: lane {lane}" : $"{group}: no lane";
}
