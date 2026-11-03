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

public interface IVehicle
{
}

public class Car(string plate, bool trailer) : IVehicle
{
    public string Plate { get; } = plate;
    public bool Trailer { get; } = trailer;
}

public class Lorry(string plate, int axles) : IVehicle
{
    public string Plate { get; } = plate;
    public int Axles { get; } = axles;
}

public class Motorbike(string plate) : IVehicle
{
    public string Plate { get; } = plate;
}

// Each report switches on the kind of vehicle. A new kind of vehicle has to be added to every switch,
// and nothing warns about a switch that was missed: it falls through to the `_` arm.
public static class TollRoad
{
    public static int Takings(List<IVehicle> vehicles) => vehicles.Sum(vehicle => vehicle switch
    {
        Car car => car.Trailer ? 7 : 4,
        Lorry lorry => 5 * lorry.Axles,
        Motorbike => 2,
        _ => 0,
    });

    public static List<string> Tickets(List<IVehicle> vehicles) => vehicles.Select(vehicle => vehicle switch
    {
        Car car => car.Trailer ? $"{car.Plate}: car with trailer" : $"{car.Plate}: car",
        Lorry lorry => $"{lorry.Plate}: lorry, {lorry.Axles} axles",
        Motorbike motorbike => $"{motorbike.Plate}: motorbike",
        _ => "",
    }).ToList();
}
