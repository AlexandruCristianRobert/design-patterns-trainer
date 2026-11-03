var lift = new Lift();
Console.WriteLine($"call 3: {lift.Call(3)} [{lift.Status}]");
Console.WriteLine($"open: {lift.Open()} [{lift.Status}]");
Console.WriteLine($"arrive: {lift.Arrive()} [{lift.Status}]");
Console.WriteLine($"call 0: {lift.Call(0)} [{lift.Status}]");
Console.WriteLine($"close: {lift.Close()} [{lift.Status}]");

// One method for each thing that can happen to the lift. Each state gets the lift in every call.
public abstract class LiftState
{
    public abstract string Name { get; }
    public abstract string Call(Lift lift, int floor);
    public virtual string Arrive(Lift lift) => "not moving";
    public abstract string Open(Lift lift);
    public abstract string Close(Lift lift);
}

// The lift in a block of flats, with floors 0 to 5. It keeps the floor it is at and its current state.
public class Lift
{
    private LiftState state = new Idle();

    public int Floor { get; private set; }

    public string Status => state.Name;

    public void SetState(LiftState next) => state = next;
    public void ReachFloor(int floor) => Floor = floor;

    // There is no such floor, whatever the lift is doing.
    public string Call(int floor) => floor is < 0 or > 5 ? $"no floor {floor}" : state.Call(this, floor);
    public string Arrive() => state.Arrive(this);
    public string Open() => state.Open(this);
    public string Close() => state.Close(this);
}

// Standing at a floor with the doors closed.
public class Idle : LiftState
{
    public override string Name => "idle";

    public override string Call(Lift lift, int floor)
    {
        if (floor == lift.Floor) return Open(lift);
        lift.SetState(new Moving(floor));
        return $"going to {floor}";
    }

    public override string Open(Lift lift)
    {
        lift.SetState(new DoorsOpen());
        return "doors opening";
    }

    public override string Close(Lift lift) => "doors already closed";
}

// On the way to a floor. It remembers where it is going.
public class Moving(int target) : LiftState
{
    public override string Name => "moving";

    public override string Call(Lift lift, int floor) => $"busy, going to {target}";

    public override string Arrive(Lift lift)
    {
        lift.ReachFloor(target);
        lift.SetState(new DoorsOpen());
        return $"arrived at {target}";
    }

    public override string Open(Lift lift) => "not between floors";
    public override string Close(Lift lift) => "doors already closed";
}

public class DoorsOpen : LiftState
{
    public override string Name => "doors open";

    public override string Call(Lift lift, int floor) =>
        floor == lift.Floor ? "doors already open" : "close the doors first";

    public override string Open(Lift lift) => "doors already open";

    public override string Close(Lift lift)
    {
        lift.SetState(new Idle());
        return "doors closed";
    }
}
