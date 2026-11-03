var crossing = new Crossing();
Console.WriteLine($"press: {crossing.Press()}");
for (var i = 0; i < 5; i++)
    Console.WriteLine($"tick: {crossing.Tick()} [{crossing.Status}]");

// One method for each thing that can happen at the crossing.
public interface ICrossingState
{
    string Name { get; }
    string Press();
    string Tick();
}

// The lights at a pedestrian crossing. Each state holds the crossing it belongs to, so it can switch it.
public class Crossing
{
    private ICrossingState state;

    public Crossing() => state = new CarsGo(this);

    public string Status => state.Name;

    public void SetState(ICrossingState next) => state = next;

    public string Press() => state.Press();
    public string Tick() => state.Tick();
}

public class CarsGo(Crossing crossing) : ICrossingState
{
    public string Name => "cars go";

    public string Press()
    {
        crossing.SetState(new Waiting(crossing));
        return "wait";
    }

    public string Tick() => "cars go";
}

public class Waiting(Crossing crossing) : ICrossingState
{
    public string Name => "waiting";

    public string Press() => "wait";

    public string Tick()
    {
        crossing.SetState(new CarsAmber(crossing));
        return "cars amber";
    }
}

public class CarsAmber(Crossing crossing) : ICrossingState
{
    public string Name => "cars amber";

    public string Press() => "wait";

    public string Tick()
    {
        crossing.SetState(new Walk(crossing));
        return "walk";
    }
}

public class Walk(Crossing crossing) : ICrossingState
{
    public string Name => "walk";

    public string Press() => "walk now";

    public string Tick()
    {
        crossing.SetState(new Hurry(crossing));
        return "hurry";
    }
}

public class Hurry(Crossing crossing) : ICrossingState
{
    public string Name => "hurry";

    public string Press() => "press again when the cars go";

    public string Tick()
    {
        crossing.SetState(new CarsGo(crossing));
        return "cars go";
    }
}
