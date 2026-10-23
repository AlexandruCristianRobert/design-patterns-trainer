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
            new CarWithGps("hatchback", 30),
            new CarWithChildSeat("estate", 45),
            new CarWithGpsAndChildSeat("estate", 45),
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
    public virtual int PricePerDay() => pricePerDay;
    public virtual string Summary() => model;
}

public class CarWithGps(string model, int pricePerDay) : CarRental(model, pricePerDay)
{
    public override int PricePerDay() => base.PricePerDay() + 5;
    public override string Summary() => base.Summary() + " + GPS";
}

public class CarWithChildSeat(string model, int pricePerDay) : CarRental(model, pricePerDay)
{
    public override int PricePerDay() => base.PricePerDay() + 8;
    public override string Summary() => base.Summary() + " + child seat";
}

// Both extras at once needs a class of its own, and repeats what the two classes above do.
public class CarWithGpsAndChildSeat(string model, int pricePerDay) : CarRental(model, pricePerDay)
{
    public override int PricePerDay() => base.PricePerDay() + 5 + 8;
    public override string Summary() => base.Summary() + " + GPS + child seat";
}
