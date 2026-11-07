// The microwave hands every button to its current state. The state answers and decides which state comes next.
var oven = new Microwave();
Console.WriteLine($"start: {oven.Start()} ({oven.Status})");
Console.WriteLine($"open door: {oven.OpenDoor()} ({oven.Status})");
Console.WriteLine($"close door: {oven.CloseDoor()} ({oven.Status})");

// One method for each thing that can happen to the microwave. Leave as is.
public interface IOvenState
{
    string Name { get; }
    string OpenDoor(Microwave oven);
    string CloseDoor(Microwave oven);
    string Start(Microwave oven);
}

// Holds the current state and passes every button on to it.
public class Microwave
{
    private IOvenState state = new Ready();

    public string Status => state.Name;

    public void SetState(IOvenState next) => state = next;

    public string OpenDoor() => state.OpenDoor(this);
    public string CloseDoor() => state.CloseDoor(this);

    // TODO: pass start on to the current state, as the two buttons above do.
    public string Start() => "";
}

// Door closed, nothing cooking.
public class Ready : IOvenState
{
    public string Name => "ready";

    public string OpenDoor(Microwave oven)
    {
        oven.SetState(new DoorOpen());
        return "door open";
    }

    public string CloseDoor(Microwave oven) => "door already closed";

    // TODO: switch the microwave to Cooking and answer "cooking".
    public string Start(Microwave oven) => "";
}

// Door open, nothing cooking. Leave as is.
public class DoorOpen : IOvenState
{
    public string Name => "door open";

    public string OpenDoor(Microwave oven) => "door already open";

    public string CloseDoor(Microwave oven)
    {
        oven.SetState(new Ready());
        return "ready";
    }

    public string Start(Microwave oven) => "close the door first";
}

// Door closed, the food turning.
public class Cooking : IOvenState
{
    public string Name => "cooking";

    // TODO: opening the door stops the cooking: switch to DoorOpen and answer "stopped, door open".
    public string OpenDoor(Microwave oven) => "";

    public string CloseDoor(Microwave oven) => "door already closed";

    public string Start(Microwave oven) => "already cooking";
}
