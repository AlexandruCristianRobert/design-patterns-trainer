foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        var foyer = new BoxOffice(new ThermalPrinter(Screen.Lines));
        foyer.Sell(new Ticket("Dune", "C4", 1250));

        var lobby = new BoxOffice(new LabelDevice(Screen.Lines));
        lobby.Sell(new Ticket("Up", "A1", 905));
        lobby.Sell(new Ticket("Heat", "F12", 1100));

        return [.. Screen.Lines];
    }
}

// Collects what the program prints, so Demo.Run() can return it. Leave as is.
public static class Screen
{
    public static List<string> Lines { get; } = [];
}

// A ticket: the film, the seat and the price in cents.
public record Ticket(string Film, string Seat, int Cents);

public interface ITicketPrinter
{
    void Print(Ticket ticket);
}

// The foyer's old printer prints straight onto its paper roll.
public class ThermalPrinter(List<string> paper) : ITicketPrinter
{
    public void Print(Ticket ticket) =>
        paper.Add($"{ticket.Film}, seat {ticket.Seat}, {ticket.Cents / 100}.{ticket.Cents % 100:D2}");
}

// The lobby's new label printer comes with its maker's class. It is not ours, so leave it as it is.
public sealed class LabelDevice(List<string> paper)
{
    public void PrintLabel(string heading, string detail) => paper.Add($"[{heading} | {detail}]");
}

public class BoxOffice
{
    private readonly ITicketPrinter? printer;
    private readonly LabelDevice? device;

    public BoxOffice(ITicketPrinter printer) => this.printer = printer;

    // Added for the lobby. Every new kind of printer means another constructor, field and branch in here.
    public BoxOffice(LabelDevice device) => this.device = device;

    public void Sell(Ticket ticket)
    {
        if (device is not null)
            device.PrintLabel(ticket.Film.ToUpperInvariant(), $"{ticket.Seat} {ticket.Cents / 100}.{ticket.Cents % 100:D2}");
        else
            printer!.Print(ticket);
    }
}
