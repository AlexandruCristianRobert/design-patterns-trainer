var tablet = new CounterTablet(new Pickup(new Prescriptions(), new PriceList(), new CardReader(), new ShelfRobot()));
Console.WriteLine(tablet.Scan(" rx300"));
Console.WriteLine(tablet.Scan("RX200"));
Console.WriteLine(tablet.Scan("rx999"));
foreach (var line in PickupLog.Lines)
    Console.WriteLine(line);

// Collects what the pharmacy's classes did, in order.
public static class PickupLog
{
    public static List<string> Lines { get; } = [];
}

// Prescriptions are filed under upper-case codes.
public class Prescriptions
{
    public string? Medicine(string code)
    {
        string? medicine = code switch { "RX100" => "Aspirin", "RX200" => "Insulin", "RX300" => "Ibuprofen", _ => null };
        PickupLog.Lines.Add(medicine is null ? $"no prescription {code}" : $"found {medicine} for {code}");
        return medicine;
    }
}

// Prices are in cents.
public class PriceList
{
    public int Cents(string medicine) => medicine switch { "Aspirin" => 450, "Ibuprofen" => 1275, _ => 0 };
}

// The card reader wants whole euros and the cents left over.
public class CardReader
{
    public void Charge(int euros, int cents) => PickupLog.Lines.Add($"charged {euros} EUR {cents}");
}

public class ShelfRobot
{
    public void Fetch(string medicine) => PickupLog.Lines.Add($"robot fetches {medicine}");
}

// One call hands out a prescription. It deals with every class's own format, so the tablet never has to.
public class Pickup(Prescriptions prescriptions, PriceList prices, CardReader reader, ShelfRobot robot)
{
    public string? Collect(string typedCode)
    {
        var medicine = prescriptions.Medicine(typedCode.Trim().ToUpperInvariant());
        if (medicine is null)
            return null;

        var cents = prices.Cents(medicine);
        if (cents > 0)
            reader.Charge(cents / 100, cents % 100);
        robot.Fetch(medicine);
        return medicine;
    }
}

// The tablet on the counter. It only knows Pickup.
public class CounterTablet(Pickup pickup)
{
    public string Scan(string typedCode) =>
        pickup.Collect(typedCode) is { } medicine ? $"{medicine} is on its way" : $"No prescription for {typedCode}";
}
