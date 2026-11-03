// The microwave hands every button to its current state. The state answers and decides which state comes next.
var oven = new Microwave();
Console.WriteLine($"start: {oven.Start()} ({oven.Status})");
Console.WriteLine($"open door: {oven.OpenDoor()} ({oven.Status})");
Console.WriteLine($"close door: {oven.CloseDoor()} ({oven.Status})");
Console.WriteLine($"stop: {oven.Stop()} ({oven.Status})");

// One method for each thing that can happen to the microwave. Each state answers it in its own way. Leave as is.
public interface IOvenState
{
    string Name { get; }
    string OpenDoor(Microwave oven);
    string CloseDoor(Microwave oven);
    string Start(Microwave oven);
    string Stop(Microwave oven);
}

// Holds the current state and passes every button on to it. Leave as is.
public class Microwave
{
    private IOvenState state = new Ready();

    public string Status => state.Name;

    public void SetState(IOvenState next) => state = next;

    public string OpenDoor() => state.OpenDoor(this);
    public string CloseDoor() => state.CloseDoor(this);
    public string Start() => state.Start(this);
    public string Stop() => state.Stop(this);
}

// Door closed, nothing cooking. Leave as is.
public class Ready : IOvenState
{
    public string Name => "ready";

    public string OpenDoor(Microwave oven)
    {
        oven.SetState(new DoorOpen());
        return "door open";
    }

    public string CloseDoor(Microwave oven) => "door already closed";

    public string Start(Microwave oven)
    {
        oven.SetState(new Cooking());
        return "cooking";
    }

    public string Stop(Microwave oven) => "nothing to stop";
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

    public string Stop(Microwave oven) => "nothing to stop";
}

// Door closed, the food turning. Closing the door and pressing start are finished.
public class Cooking : IOvenState
{
    public string Name => "cooking";

    // TODO: pause: switch to Paused and answer "paused, close the door to go on".
    public string OpenDoor(Microwave oven) => "";

    public string CloseDoor(Microwave oven) => "door already closed";

    public string Start(Microwave oven) => "already cooking";

    // TODO: switch to Ready and answer "stopped".
    public string Stop(Microwave oven) => "";
}

// The door was opened while cooking: the food waits inside.
public class Paused : IOvenState
{
    public string Name => "paused";

    // TODO: answer "door already open".
    public string OpenDoor(Microwave oven) => "";

    // TODO: switch back to Cooking and answer "cooking again".
    public string CloseDoor(Microwave oven) => "";

    // TODO: answer "close the door first".
    public string Start(Microwave oven) => "";

    // TODO: switch to DoorOpen and answer "stopped, door open".
    public string Stop(Microwave oven) => "";
}
