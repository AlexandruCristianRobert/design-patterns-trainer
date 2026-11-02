// Write LaneDesk and BookingTablet as described in the scenario.
// The types below are given. Leave them as they are.

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
