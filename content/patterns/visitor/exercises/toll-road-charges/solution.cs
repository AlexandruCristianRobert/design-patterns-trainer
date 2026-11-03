foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        List<IVehicle> today = [new Car("AB-123", false), new Lorry("LK-77", 4), new Car("CD-456", true), new Motorbike("MB-9")];
        var lines = TollRoad.Tickets(today);
        lines.Add($"takings: {TollRoad.Takings(today)} EUR");
        return lines;
    }
}

// A vehicle hands itself to a visitor, and each vehicle class calls the Visit for its own class.
public interface IVehicle
{
    void Accept(IVehicleVisitor visitor);
}

// A new kind of vehicle is a new Visit here, and the compiler then points at every visitor that lacks it.
public interface IVehicleVisitor
{
    void Visit(Car car);
    void Visit(Lorry lorry);
    void Visit(Motorbike motorbike);
}

public class Car(string plate, bool trailer) : IVehicle
{
    public string Plate { get; } = plate;
    public bool Trailer { get; } = trailer;

    public void Accept(IVehicleVisitor visitor) => visitor.Visit(this);
}

public class Lorry(string plate, int axles) : IVehicle
{
    public string Plate { get; } = plate;
    public int Axles { get; } = axles;

    public void Accept(IVehicleVisitor visitor) => visitor.Visit(this);
}

public class Motorbike(string plate) : IVehicle
{
    public string Plate { get; } = plate;

    public void Accept(IVehicleVisitor visitor) => visitor.Visit(this);
}

public class TollCharge : IVehicleVisitor
{
    public int Total { get; private set; }

    public void Visit(Car car) => Total += car.Trailer ? 7 : 4;
    public void Visit(Lorry lorry) => Total += 5 * lorry.Axles;
    public void Visit(Motorbike motorbike) => Total += 2;
}

public class TicketPrinter : IVehicleVisitor
{
    public List<string> Tickets { get; } = new();

    public void Visit(Car car) => Tickets.Add(car.Trailer ? $"{car.Plate}: car with trailer" : $"{car.Plate}: car");
    public void Visit(Lorry lorry) => Tickets.Add($"{lorry.Plate}: lorry, {lorry.Axles} axles");
    public void Visit(Motorbike motorbike) => Tickets.Add($"{motorbike.Plate}: motorbike");
}

public static class TollRoad
{
    public static int Takings(List<IVehicle> vehicles)
    {
        var charge = new TollCharge();
        foreach (var vehicle in vehicles) vehicle.Accept(charge);
        return charge.Total;
    }

    public static List<string> Tickets(List<IVehicle> vehicles)
    {
        var printer = new TicketPrinter();
        foreach (var vehicle in vehicles) vehicle.Accept(printer);
        return printer.Tickets;
    }
}
