var station = new PayStation(new CarWash(new Gate(), new Sprayer(), new Brushes(), new Dryer()));
Console.WriteLine(station.Pay("AB-123", "deluxe"));
foreach (var line in WashLog.Lines)
    Console.WriteLine(line);

// Collects what the machines did, in order. Leave as is.
public static class WashLog
{
    public static List<string> Lines { get; } = [];
}

// The car wash machines. Each one does a single job. Leave them as they are.
public class Gate
{
    public void Open(string plate) => WashLog.Lines.Add($"open gate for {plate}");
    public void Close() => WashLog.Lines.Add("close gate");
}

public class Sprayer
{
    public void Soak() => WashLog.Lines.Add("soak");
    public void Rinse() => WashLog.Lines.Add("rinse");
    public void Wax() => WashLog.Lines.Add("wax");
}

public class Brushes
{
    public void Scrub(int passes) => WashLog.Lines.Add($"scrub {passes}x");
}

public class Dryer
{
    public void Dry() => WashLog.Lines.Add("dry");
}

// The facade: the pay station asks it for a wash, and it runs the machines in the right order.
public class CarWash(Gate gate, Sprayer sprayer, Brushes brushes, Dryer dryer)
{
    public bool Wash(string plate, string programme)
    {
        // TODO: "basic" opens the gate for the car, soaks, scrubs once, rinses, dries and closes the gate.
        // TODO: "deluxe" does the same, but scrubs twice and waxes between rinsing and drying.
        // TODO: return true for those two; any other programme runs no machine at all and returns false.
        return false;
    }
}

// The pay station. It only knows CarWash. Leave it as it is.
public class PayStation(CarWash wash)
{
    public string Pay(string plate, string programme) =>
        wash.Wash(plate, programme) ? $"{plate}: thank you, drive in" : $"{plate}: there is no programme called {programme}";
}
