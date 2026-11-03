var game = new TennisGame();
foreach (var player in new[] { "A", "A", "B", "B", "A", "B", "A", "B", "B", "B" })
{
    game.PointTo(player);
    Console.WriteLine($"point {player}: {game.Score}");
}

// Each stage of a game gives its score, and returns the stage that comes after a point.
public interface IScoreStage
{
    string Score { get; }
    IScoreStage PointTo(string player);
}

// One game of tennis between players A and B. It only holds the stage it is in.
public class TennisGame
{
    private IScoreStage stage = new Points(0, 0);

    public string Score => stage.Score;

    public void PointTo(string player) => stage = stage.PointTo(player);
}

// Before deuce: 0, 15, 30 and 40 for each player.
public class Points(int a, int b) : IScoreStage
{
    private static readonly string[] Calls = ["0", "15", "30", "40"];

    public string Score => $"{Calls[a]}-{Calls[b]}";

    public IScoreStage PointTo(string player)
    {
        var (winner, mine, theirs) = player == "A" ? ("A", a, b) : ("B", b, a);
        if (mine == 3) return new Game(winner);
        if (mine == 2 && theirs == 3) return new Deuce();
        return player == "A" ? new Points(a + 1, b) : new Points(a, b + 1);
    }
}

public class Deuce : IScoreStage
{
    public string Score => "deuce";

    public IScoreStage PointTo(string player) => new Advantage(player);
}

public class Advantage(string player) : IScoreStage
{
    public string Score => $"advantage {player}";

    public IScoreStage PointTo(string winner) => winner == player ? new Game(player) : new Deuce();
}

// The game is over: more points change nothing.
public class Game(string winner) : IScoreStage
{
    public string Score => $"game {winner}";

    public IScoreStage PointTo(string player) => this;
}
