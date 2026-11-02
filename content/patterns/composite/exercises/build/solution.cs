var desk = new PowerStrip(1000);
desk.Add(new Appliance("Laptop", 65));
desk.Add(new Appliance("Monitor", 30));

var kitchen = new PowerStrip(3500);
kitchen.Add(new Appliance("Kettle", 2200));
kitchen.Add(desk);
kitchen.Add(new Appliance("Toaster", 900));

Console.WriteLine(new WallSocket(kitchen).Report());
Console.WriteLine($"kitchen strip overloaded: {kitchen.Overloaded()}");
Console.WriteLine(new WallSocket(new Appliance("Fridge", 150)).Report());
Console.WriteLine(new WallSocket(new PowerStrip(2000)).Report());

// Anything that goes into a socket: one appliance, or a strip with more plugged into it.
public interface IPlug
{
    int Watts();
    List<string> Devices();
}

// One appliance answers for itself.
public class Appliance(string name, int watts) : IPlug
{
    public int Watts() => watts;
    public List<string> Devices() => [name];
}

// The composite: a strip passes each question on to whatever is plugged into it and combines the answers.
public class PowerStrip(int maxWatts) : IPlug
{
    private readonly List<IPlug> plugs = [];

    public void Add(IPlug plug) => plugs.Add(plug);

    public int Watts() => plugs.Sum(p => p.Watts());

    public List<string> Devices() => plugs.SelectMany(p => p.Devices()).ToList();

    public bool Overloaded() => Watts() > maxWatts;
}

// The wall socket only knows IPlug, so it takes an appliance or a strip alike.
public class WallSocket(IPlug plug)
{
    public string Report()
    {
        var devices = plug.Devices();
        return $"{plug.Watts()} W: {(devices.Count == 0 ? "nothing" : string.Join(", ", devices))}";
    }
}
