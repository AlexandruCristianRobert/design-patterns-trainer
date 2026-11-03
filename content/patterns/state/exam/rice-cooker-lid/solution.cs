var cooker = new RiceCooker();
Console.WriteLine($"cook: {cooker.Cook()}");
Console.WriteLine($"open lid: {cooker.OpenLid()}");
Console.WriteLine($"rice done: {cooker.RiceDone()}");
cooker.Hour();
cooker.Hour();
cooker.Hour();
Console.WriteLine($"after 3 hours: {cooker.Status}");

// What the cooker does with each button, in each stage.
public interface ICookerStage
{
    string Name { get; }
    string Cook(RiceCooker cooker);
    string RiceDone(RiceCooker cooker);
    string OpenLid(RiceCooker cooker);
    string CloseLid(RiceCooker cooker);
    void Hour(RiceCooker cooker);
}

// A rice cooker with a lid. It only holds the stage it is in and passes every button on to it.
public class RiceCooker
{
    private ICookerStage stage = new Off();

    public string Status => stage.Name;

    public void MoveTo(ICookerStage next) => stage = next;

    public string Cook() => stage.Cook(this);
    public string RiceDone() => stage.RiceDone(this);
    public string OpenLid() => stage.OpenLid(this);
    public string CloseLid() => stage.CloseLid(this);
    public void Hour() => stage.Hour(this);
}

public class Off : ICookerStage
{
    public string Name => "off";

    public string Cook(RiceCooker cooker)
    {
        cooker.MoveTo(new Cooking());
        return "cooking";
    }

    public string RiceDone(RiceCooker cooker) => "not cooking";

    public string OpenLid(RiceCooker cooker)
    {
        cooker.MoveTo(new LidOpen());
        return "lid open";
    }

    public string CloseLid(RiceCooker cooker) => "lid already closed";
    public void Hour(RiceCooker cooker) { }
}

public class LidOpen : ICookerStage
{
    public string Name => "lid open";

    public string Cook(RiceCooker cooker) => "close the lid first";
    public string RiceDone(RiceCooker cooker) => "not cooking";
    public string OpenLid(RiceCooker cooker) => "lid already open";

    public string CloseLid(RiceCooker cooker)
    {
        cooker.MoveTo(new Off());
        return "off";
    }

    public void Hour(RiceCooker cooker) { }
}

public class Cooking : ICookerStage
{
    public string Name => "cooking";

    public string Cook(RiceCooker cooker) => "already cooking";

    public string RiceDone(RiceCooker cooker)
    {
        cooker.MoveTo(new KeepingWarm());
        return "keeping warm";
    }

    public string OpenLid(RiceCooker cooker) => "lid locked while cooking";
    public string CloseLid(RiceCooker cooker) => "lid already closed";
    public void Hour(RiceCooker cooker) { }
}

// Keeps the rice warm for 3 hours, then turns off. A new one starts counting from 0.
public class KeepingWarm : ICookerStage
{
    private int hours;

    public string Name => "keeping warm";

    public string Cook(RiceCooker cooker) => "already cooked";
    public string RiceDone(RiceCooker cooker) => "not cooking";

    public string OpenLid(RiceCooker cooker)
    {
        cooker.MoveTo(new LidOpen());
        return "lid open, enjoy";
    }

    public string CloseLid(RiceCooker cooker) => "lid already closed";

    public void Hour(RiceCooker cooker)
    {
        hours++;
        if (hours == 3) cooker.MoveTo(new Off());
    }
}
