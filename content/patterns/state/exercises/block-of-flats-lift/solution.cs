var lift = new Lift();
Console.WriteLine($"call: {lift.Call()} [{lift.Status}]");
Console.WriteLine($"arrive: {lift.Arrive()} [{lift.Status}]");
Console.WriteLine($"call: {lift.Call()} [{lift.Status}]");
Console.WriteLine($"close doors: {lift.CloseDoors()} [{lift.Status}]");

// One method per button. The virtual ones give the answer most states share.
public abstract class LiftState
{
    public abstract string Name { get; }
    public abstract string Call(Lift lift);
    public virtual string Arrive(Lift lift) => "not moving";
    public virtual string CloseDoors(Lift lift) => "doors already closed";
}

// The lift holds its current state and passes every button on to it.
public class Lift
{
    private LiftState state = new Idle();

    public string Status => state.Name;

    public void SetState(LiftState next) => state = next;

    public string Call() => state.Call(this);
    public string Arrive() => state.Arrive(this);
    public string CloseDoors() => state.CloseDoors(this);
}

public class Idle : LiftState
{
    public override string Name => "idle";

    public override string Call(Lift lift)
    {
        lift.SetState(new Moving());
        return "on its way";
    }
}

public class Moving : LiftState
{
    public override string Name => "moving";

    public override string Call(Lift lift) => "busy";

    public override string Arrive(Lift lift)
    {
        lift.SetState(new DoorsOpen());
        return "doors opening";
    }
}

public class DoorsOpen : LiftState
{
    public override string Name => "doors open";

    public override string Call(Lift lift) => "close the doors first";

    public override string CloseDoors(Lift lift)
    {
        lift.SetState(new Idle());
        return "doors closed";
    }
}
