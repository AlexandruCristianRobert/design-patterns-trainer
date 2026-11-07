var lobby = new Lobby();
var ana = lobby.Join();
var ben = lobby.Join();
ana.Ready();
Console.WriteLine($"Ana ready, countdown running: {lobby.Countdown.IsRunning}");
ben.Ready();
Console.WriteLine($"Ben ready, countdown running: {lobby.Countdown.IsRunning}");
lobby.Countdown.Cancel();
Console.WriteLine($"cancelled, Ana ready: {ana.IsReady}, Ben ready: {ben.IsReady}");

// Holds the players and the countdown, and the rules about how they affect each other.
public class Lobby
{
    private readonly List<Player> players = [];

    public Countdown Countdown { get; }

    public Lobby() => Countdown = new Countdown(this);

    public Player Join()
    {
        var player = new Player(this);
        players.Add(player);
        return player;
    }

    // Called by a player who got ready.
    public void PlayerReady()
    {
        if (players.All(p => p.IsReady)) Countdown.Start();
    }

    // Called by the countdown when it was cancelled.
    public void CountdownCancelled()
    {
        foreach (var player in players) player.Unready();
    }
}

public class Player(Lobby lobby)
{
    public bool IsReady { get; private set; }

    public void Ready()
    {
        IsReady = true;
        lobby.PlayerReady();
    }

    // Used by the lobby.
    public void Unready() => IsReady = false;
}

public class Countdown(Lobby lobby)
{
    public bool IsRunning { get; private set; }

    public void Cancel()
    {
        IsRunning = false;
        lobby.CountdownCancelled();
    }

    // Used by the lobby.
    public void Start() => IsRunning = true;
}
