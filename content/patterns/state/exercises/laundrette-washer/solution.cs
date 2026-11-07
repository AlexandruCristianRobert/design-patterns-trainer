foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var washer = new Washer();
        var lines = new List<string>();
        void Say(string button, string answer) => lines.Add($"{button}: {answer} [{washer.Status}]");
        Say("start", washer.Start());
        Say("coin", washer.InsertCoin());
        Say("coin", washer.InsertCoin());
        Say("start", washer.Start());
        Say("coin", washer.InsertCoin());
        Say("finish", washer.Finish());
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
}

// A coin washing machine at a laundrette. It holds the current state and passes every button on to it.
public class Washer
{
    private IWasherState state = new Idle();

    public string Status => state.Name;

    public void SetState(IWasherState next) => state = next;

    public string InsertCoin() => state.InsertCoin(this);
    public string Start() => state.Start(this);
    public string Finish() => state.Finish(this);
}

public class Idle : IWasherState
{
    public string Name => "idle";

    public string InsertCoin(Washer washer)
    {
        washer.SetState(new Paid());
        return "paid, press start";
    }

    public string Start(Washer washer) => "insert a coin first";
    public string Finish(Washer washer) => "not washing";
}

public class Paid : IWasherState
{
    public string Name => "paid";

    public string InsertCoin(Washer washer) => "already paid, coin returned";

    public string Start(Washer washer)
    {
        washer.SetState(new Washing());
        return "washing";
    }

    public string Finish(Washer washer) => "not washing";
}

public class Washing : IWasherState
{
    public string Name => "washing";

    public string InsertCoin(Washer washer) => "busy, coin returned";
    public string Start(Washer washer) => "already washing";

    public string Finish(Washer washer)
    {
        washer.SetState(new Idle());
        return "done";
    }
}
