FareTable.Current.Set("Single", 120);
Console.WriteLine(new TicketMachine().Quote("Single", 3));
FareTable.Current.Set("Single", 150);
Console.WriteLine(new PhoneApp().Quote("Single", 3));
Console.WriteLine(new PhoneApp().Quote("Night owl", 1));

public sealed class FareTable
{
    public static FareTable Current { get; } = new();

    private readonly Dictionary<string, int> perZone = [];

    private FareTable() { }

    public void Set(string ticket, int centsPerZone) => perZone[ticket] = centsPerZone;

    public string Quote(string ticket, int zones) =>
        perZone.TryGetValue(ticket, out var cents) ? $"{ticket}, {zones} zones: {cents * zones} cents" : $"{ticket}: not sold";
}

public class TicketMachine
{
    public string Quote(string ticket, int zones) => $"Machine | {FareTable.Current.Quote(ticket, zones)}";
}

public class PhoneApp
{
    public string Quote(string ticket, int zones) => $"App | {FareTable.Current.Quote(ticket, zones)}";
}
