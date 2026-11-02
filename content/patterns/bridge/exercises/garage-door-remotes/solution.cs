var remote = new SmartRemote(new BeltMotor());
Console.WriteLine(remote.Vent());
Console.WriteLine(remote.Press());
Console.WriteLine(remote.Press());

// What every door motor can do: move the door up or down by some centimetres.
public abstract class DoorMotor
{
    public abstract string Raise(int cm);
    public abstract string Lower(int cm);
}

public class ChainMotor : DoorMotor
{
    public override string Raise(int cm) => $"chain up {cm} cm";
    public override string Lower(int cm) => $"chain down {cm} cm";
}

public class BeltMotor : DoorMotor
{
    public override string Raise(int cm) => $"quiet belt up {cm} cm";
    public override string Lower(int cm) => $"quiet belt down {cm} cm";
}

// A remote holds the motor of its door and keeps track of how far the door is open.
public abstract class Remote(DoorMotor motor)
{
    protected DoorMotor Motor => motor;

    public int Height { get; protected set; }

    public string Press()
    {
        if (Height == 0)
        {
            Height = 200;
            return motor.Raise(200);
        }
        var lowered = motor.Lower(Height);
        Height = 0;
        return lowered;
    }
}

public class BasicRemote(DoorMotor motor) : Remote(motor);

public class SmartRemote(DoorMotor motor) : Remote(motor)
{
    public string Vent()
    {
        if (Height != 0) return "already open";
        Height = 20;
        return Motor.Raise(20);
    }
}
