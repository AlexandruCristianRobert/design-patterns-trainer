foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        List<IVehicle> today = [new Car("AB-123"), new Lorry("LK-77", 4), new Car("CD-456"), new Motorbike("MB-9")];
        var lines = TollRoad.Tickets(today);
        lines.Add($"takings: {TollRoad.Takings(today)} EUR");
        return lines;
    }
}

// A vehicle hands itself to a visitor, which returns its answer for that vehicle.
// A new kind of vehicle adds a Visit here, and every visitor that lacks it stops compiling.
public interface IVehicle
{
    T Accept<T>(IVehicleVisitor<T> visitor);
}

public interface IVehicleVisitor<T>
{
    T Visit(Car car);
    T Visit(Lorry lorry);
    T Visit(Motorbike motorbike);
}

public class Car(string plate) : IVehicle
{
    public string Plate { get; } = plate;

    public T Accept<T>(IVehicleVisitor<T> visitor) => visitor.Visit(this);
}

public class Lorry(string plate, int axles) : IVehicle
{
    public string Plate { get; } = plate;
    public int Axles { get; } = axles;

    public T Accept<T>(IVehicleVisitor<T> visitor) => visitor.Visit(this);
}

public class Motorbike(string plate) : IVehicle
{
    public string Plate { get; } = plate;

    public T Accept<T>(IVehicleVisitor<T> visitor) => visitor.Visit(this);
}

public class TollCharge : IVehicleVisitor<int>
{
    public int Visit(Car car) => 4;
    public int Visit(Lorry lorry) => 5 * lorry.Axles;
    public int Visit(Motorbike motorbike) => 2;
}

public class TicketPrinter : IVehicleVisitor<string>
{
    public string Visit(Car car) => $"{car.Plate}: car";
    public string Visit(Lorry lorry) => $"{lorry.Plate}: lorry, {lorry.Axles} axles";
    public string Visit(Motorbike motorbike) => $"{motorbike.Plate}: motorbike";
}

public static class TollRoad
{
    public static int Takings(List<IVehicle> vehicles) => vehicles.Sum(vehicle => vehicle.Accept(new TollCharge()));

    public static List<string> Tickets(List<IVehicle> vehicles) => vehicles.Select(vehicle => vehicle.Accept(new TicketPrinter())).ToList();
}
