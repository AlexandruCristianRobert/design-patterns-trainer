foreach (var line in new Explosion(new Gamepad()).Play())
    Console.WriteLine(line);
foreach (var line in new Heartbeat(new Phone(), 2).Play())
    Console.WriteLine(line);

// What every controller can do: buzz for a while at some strength, or stay still for a while.
public abstract class Controller
{
    public abstract string Buzz(int ms, int strength);
    public abstract string Wait(int ms);
}

public class Gamepad : Controller
{
    public override string Buzz(int ms, int strength) => $"pad rumble {strength}% {ms} ms";
    public override string Wait(int ms) => $"pad wait {ms} ms";
}

public class Phone : Controller
{
    // A phone cannot change how strongly it vibrates, so it ignores the strength.
    public override string Buzz(int ms, int strength) => $"phone vibrate {ms} ms";
    public override string Wait(int ms) => $"phone pause {ms} ms";
}

// An effect holds the controller it plays on and decides only the rhythm.
public abstract class Effect(Controller controller)
{
    protected Controller Controller => controller;

    public abstract List<string> Play();
}

public class Explosion(Controller controller) : Effect(controller)
{
    public override List<string> Play() => [Controller.Buzz(400, 100)];
}

public class Heartbeat(Controller controller, int beats) : Effect(controller)
{
    public override List<string> Play()
    {
        var steps = new List<string>();
        for (var beat = 1; beat <= beats; beat++)
        {
            if (beat > 1) steps.Add(Controller.Wait(600));
            steps.Add(Controller.Buzz(100, 40));
            steps.Add(Controller.Wait(150));
            steps.Add(Controller.Buzz(100, 40));
        }
        return steps;
    }
}
