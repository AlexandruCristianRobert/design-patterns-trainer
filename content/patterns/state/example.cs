// The scooter hands every call to its current state. The state decides what happens and which state comes next.
var scooter = new Scooter();
Console.WriteLine($"pause: {scooter.Pause()}");
Console.WriteLine($"unlock: {scooter.Unlock()}");
Console.WriteLine($"pause: {scooter.Pause()}");
Console.WriteLine($"resume: {scooter.Resume()}");
Console.WriteLine($"end: {scooter.End()}");

public interface IScooterState
{
    string Unlock(Scooter scooter);
    string Pause(Scooter scooter);
    string Resume(Scooter scooter);
    string End(Scooter scooter);
}

public class Scooter
{
    private IScooterState state = new Locked();

    public int Pauses { get; set; }

    public void SetState(IScooterState next) => state = next;

    public string Unlock() => state.Unlock(this);
    public string Pause() => state.Pause(this);
    public string Resume() => state.Resume(this);
    public string End() => state.End(this);
}

public class Locked : IScooterState
{
    public string Unlock(Scooter scooter)
    {
        scooter.SetState(new Riding());
        return "riding";
    }

    public string Pause(Scooter scooter) => "locked, unlock it first";
    public string Resume(Scooter scooter) => "locked, unlock it first";
    public string End(Scooter scooter) => "no ride to end";
}

public class Riding : IScooterState
{
    public string Unlock(Scooter scooter) => "already unlocked";

    public string Pause(Scooter scooter)
    {
        scooter.Pauses++;
        scooter.SetState(new Paused());
        return $"paused (pause {scooter.Pauses})";
    }

    public string Resume(Scooter scooter) => "already riding";

    public string End(Scooter scooter)
    {
        scooter.SetState(new Locked());
        return "ride over, locked";
    }
}

public class Paused : IScooterState
{
    public string Unlock(Scooter scooter) => "already unlocked";

    public string Pause(Scooter scooter) => "already paused";

    public string Resume(Scooter scooter)
    {
        scooter.SetState(new Riding());
        return "riding again";
    }

    public string End(Scooter scooter)
    {
        scooter.SetState(new Locked());
        return "ride over, locked";
    }
}
