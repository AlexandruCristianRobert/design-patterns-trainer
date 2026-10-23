ParkingMeter street = new StreetMeter();
Console.WriteLine(street.Pay(45));
Console.WriteLine(street.Pay(61));

ParkingMeter garage = new GarageMeter();
Console.WriteLine(garage.Pay(130));
Console.WriteLine($"taken: {street.TakenCents} on the street, {garage.TakenCents} in the garage");

public interface IReceipt
{
    string Show(int minutes, int cents);
}

public class PaperReceipt : IReceipt
{
    public string Show(int minutes, int cents) => $"PAID {minutes} MIN {cents / 100}.{cents % 100:D2} EUR";
}

public class AppReceipt : IReceipt
{
    public string Show(int minutes, int cents) => $"Parking: {minutes} min, {cents} cents";
}

public abstract class ParkingMeter
{
    public int TakenCents { get; private set; }

    // Each kind of meter decides which receipt it gives.
    protected abstract IReceipt NewReceipt();

    public string Pay(int minutes)
    {
        var cents = (minutes + 59) / 60 * 150;
        TakenCents += cents;
        return NewReceipt().Show(minutes, cents);
    }
}

public class StreetMeter : ParkingMeter
{
    protected override IReceipt NewReceipt() => new PaperReceipt();
}

public class GarageMeter : ParkingMeter
{
    protected override IReceipt NewReceipt() => new AppReceipt();
}
