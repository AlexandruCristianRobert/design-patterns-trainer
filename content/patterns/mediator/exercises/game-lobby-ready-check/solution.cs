var lobby = new Lobby();
var ana = lobby.Join("Ana");
var ben = lobby.Join("Ben");
ana.Ready();
ben.Ready();
Console.WriteLine($"countdown running: {lobby.Countdown.IsRunning}");
lobby.Countdown.Cancel();
ana.Ready();
var cleo = lobby.Join("Cleo");
cleo.Leave();
foreach (var line in ana.Seen) Console.WriteLine($"Ana saw: {line}");

// Holds the players and the countdown, and all the rules about who sees what and when the countdown runs.
public class Lobby
{
    private readonly List<Player> players = [];

    public IReadOnlyList<Player> Players => players;
    public Countdown Countdown { get; }

    public Lobby() => Countdown = new Countdown { Lobby = this };

    public Player Join(string name)
    {
        var player = new Player(name) { Lobby = this };
        foreach (var other in players) other.See($"{name} joined");
        players.Add(player);
        Check();
        return player;
    }

    // Called by a player after it got ready or not ready.
    public void ReadyChanged(Player player)
    {
        foreach (var other in players.Where(p => p != player))
            other.See(player.IsReady ? $"{player.Name} is ready" : $"{player.Name} is not ready");
        Check();
    }

    // Called by a player who leaves.
    public void Left(Player player)
    {
        players.Remove(player);
        foreach (var other in players) other.See($"{player.Name} left");
        Check();
    }

    // Called by the countdown when the host cancels it.
    public void Cancelled()
    {
        foreach (var player in players)
        {
            player.Reset();
            player.See("countdown cancelled");
        }
    }

    // The countdown runs exactly when there are at least two players and all of them are ready.
    private void Check()
    {
        var run = players.Count >= 2 && players.All(p => p.IsReady);
        if (run == Countdown.IsRunning) return;
        Countdown.Run(run);
        foreach (var player in players) player.See(run ? "countdown started" : "countdown stopped");
    }
}

public class Player(string name)
{
    private readonly List<string> seen = [];

    // Set by the lobby when the player joins.
    public Lobby Lobby { get; set; } = null!;

    public string Name => name;
    public bool IsReady { get; private set; }
    public IReadOnlyList<string> Seen => seen;

    public void Ready()
    {
        if (IsReady) return;
        IsReady = true;
        Lobby.ReadyChanged(this);
    }

    public void Unready()
    {
        if (!IsReady) return;
        IsReady = false;
        Lobby.ReadyChanged(this);
    }

    public void Leave() => Lobby.Left(this);

    // Used by the lobby.
    public void See(string line) => seen.Add(line);
    public void Reset() => IsReady = false;
}

public class Countdown
{
    // Set by the lobby that owns the countdown.
    public Lobby Lobby { get; set; } = null!;

    public bool IsRunning { get; private set; }

    public void Cancel()
    {
        if (!IsRunning) return;
        IsRunning = false;
        Lobby.Cancelled();
    }

    // Used by the lobby.
    public void Run(bool running) => IsRunning = running;
}
