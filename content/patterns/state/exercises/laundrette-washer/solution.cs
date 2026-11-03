foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var washer = new Washer();
        var lines = new List<string>();
        void Say(string button, string answer) => lines.Add($"{button}: {answer} [{washer.Status}, coins {washer.Coins}]");
        Say("start", washer.Start());
        Say("coin", washer.InsertCoin());
        Say("coin", washer.InsertCoin());
        Say("coin", washer.InsertCoin());
        Say("start", washer.Start());
        Say("open door", washer.OpenDoor());
        Say("finish", washer.Finish());
        Say("coin", washer.InsertCoin());
        Say("open door", washer.OpenDoor());
        Say("coin", washer.InsertCoin());
        return lines;
    }
}

// One method for each button. Each state answers in its own way and switches the washer when it should.
public interface IWasherState
{
    string Name { get; }
    string InsertCoin(Washer washer);
    string Start(Washer washer);
    string Finish(Washer washer);
    string OpenDoor(Washer washer);
}

// A coin washing machine at a laundrette. A wash costs 2 coins. It holds the coins and the current state,
// and passes every button on to the state.
public class Washer
{
    private IWasherState state = new Idle();

    public string Status => state.Name;
    public int Coins { get; private set; }

    public void SetState(IWasherState next) => state = next;
    public void AddCoin() => Coins++;
    public void ClearCoins() => Coins = 0;

    public string InsertCoin() => state.InsertCoin(this);
    public string Start() => state.Start(this);
    public string Finish() => state.Finish(this);
    public string OpenDoor() => state.OpenDoor(this);
}

public class Idle : IWasherState
{
    public string Name => "idle";

    public string InsertCoin(Washer washer)
    {
        washer.AddCoin();
        if (washer.Coins < 2) return $"{washer.Coins} of 2 coins paid";
        washer.SetState(new Paid());
        return "paid, press start";
    }

    public string Start(Washer washer) => $"{washer.Coins} of 2 coins paid";
    public string Finish(Washer washer) => "not washing";
    public string OpenDoor(Washer washer) => "door open";
}

public class Paid : IWasherState
{
    public string Name => "paid";

    public string InsertCoin(Washer washer) => "already paid, coin returned";

    public string Start(Washer washer)
    {
        washer.ClearCoins();
        washer.SetState(new Washing());
        return "washing";
    }

    public string Finish(Washer washer) => "not washing";
    public string OpenDoor(Washer washer) => "door open";
}

public class Washing : IWasherState
{
    public string Name => "washing";

    public string InsertCoin(Washer washer) => "busy, coin returned";
    public string Start(Washer washer) => "already washing";

    public string Finish(Washer washer)
    {
        washer.SetState(new Done());
        return "done, open the door";
    }

    public string OpenDoor(Washer washer) => "locked while washing";
}

public class Done : IWasherState
{
    public string Name => "done";

    public string InsertCoin(Washer washer) => "take your washing out first, coin returned";
    public string Start(Washer washer) => "take your washing out first";
    public string Finish(Washer washer) => "not washing";

    public string OpenDoor(Washer washer)
    {
        washer.SetState(new Idle());
        return "door open";
    }
}
