foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        List<IRental> bookings =
        [
            new CarRental("hatchback", 30),
            new Gps(new CarRental("hatchback", 30)),
            new ChildSeat(new CarRental("estate", 45)),
            new ChildSeat(new Gps(new CarRental("estate", 45))),
        ];
        foreach (var booking in bookings)
            Screen.Lines.Add($"{booking.Summary()}: {booking.PricePerDay()} per day");

        return [.. Screen.Lines];
    }
}

// Collects what the program prints, so Demo.Run() can return it. Leave as is.
public static class Screen
{
    public static List<string> Lines { get; } = [];
}

public interface IRental
{
    int PricePerDay();
    string Summary();
}

public class CarRental(string model, int pricePerDay) : IRental
{
    public int PricePerDay() => pricePerDay;
    public string Summary() => model;
}

// What every extra shares: it is a rental, and it holds the rental it adds to.
public abstract class Extra(IRental rental) : IRental
{
    protected IRental Rental { get; } = rental;

    public abstract int PricePerDay();
    public abstract string Summary();
}

public class Gps(IRental rental) : Extra(rental)
{
    public override int PricePerDay() => Rental.PricePerDay() + 5;
    public override string Summary() => Rental.Summary() + " + GPS";
}

public class ChildSeat(IRental rental) : Extra(rental)
{
    public override int PricePerDay() => Rental.PricePerDay() + 8;
    public override string Summary() => Rental.Summary() + " + child seat";
}
