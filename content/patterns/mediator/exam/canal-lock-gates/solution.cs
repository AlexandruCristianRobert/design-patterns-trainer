var lockway = new CanalLock();
lockway.Lower.Open();
Console.WriteLine($"a boat enters from below, water {lockway.Water}");
lockway.Lower.Close();
lockway.Filling.Open();
Console.WriteLine($"filling, water {lockway.Water}");
lockway.Upper.Open();
Console.WriteLine($"upper gate open: {lockway.Upper.IsOpen}");
lockway.Filling.Close();
lockway.Upper.Open();
Console.WriteLine($"upper gate open: {lockway.Upper.IsOpen}");

// What the gates and paddles ask before they open, and tell after they opened.
public interface ILockKeeper
{
    bool MayOpen(object part);
    void Opened(object part);
}

// Builds the two gates and the two paddles, gives each of them itself, and holds every rule about the water.
public class CanalLock : ILockKeeper
{
    public Gate Upper { get; }
    public Gate Lower { get; }
    public Paddle Filling { get; }
    public Paddle Emptying { get; }
    public string Water { get; private set; } = "low";

    public CanalLock()
    {
        Upper = new(this);
        Lower = new(this);
        Filling = new(this);
        Emptying = new(this);
    }

    public bool MayOpen(object part)
    {
        var paddlesClosed = !Filling.IsOpen && !Emptying.IsOpen;
        if (part == Upper) return paddlesClosed && !Lower.IsOpen && Water == "high";
        if (part == Lower) return paddlesClosed && !Upper.IsOpen && Water == "low";
        var gatesClosed = !Upper.IsOpen && !Lower.IsOpen;
        if (part == Filling) return gatesClosed && !Emptying.IsOpen;
        if (part == Emptying) return gatesClosed && !Filling.IsOpen;
        return false;
    }

    public void Opened(object part)
    {
        if (part == Filling) Water = "high";
        else if (part == Emptying) Water = "low";
    }
}

public class Gate(ILockKeeper keeper)
{
    public bool IsOpen { get; private set; }

    public void Open()
    {
        if (!keeper.MayOpen(this)) return;
        IsOpen = true;
        keeper.Opened(this);
    }

    public void Close() => IsOpen = false;
}

public class Paddle(ILockKeeper keeper)
{
    public bool IsOpen { get; private set; }

    public void Open()
    {
        if (!keeper.MayOpen(this)) return;
        IsOpen = true;
        keeper.Opened(this);
    }

    public void Close() => IsOpen = false;
}
