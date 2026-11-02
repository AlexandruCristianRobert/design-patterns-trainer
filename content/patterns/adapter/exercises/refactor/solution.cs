foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        var foyer = new BoxOffice(new ThermalPrinter(Screen.Lines));
        foyer.Sell(new Ticket("Dune", "C4", 1250));

        var lobby = new BoxOffice(new LabelPrinter(new LabelDevice(Screen.Lines)));
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

// The adapter: an ITicketPrinter on the outside, the label printer's own call on the inside.
public class LabelPrinter(LabelDevice device) : ITicketPrinter
{
    public void Print(Ticket ticket) =>
        device.PrintLabel(ticket.Film.ToUpperInvariant(), $"{ticket.Seat} {ticket.Cents / 100}.{ticket.Cents % 100:D2}");
}

// The box office sells; whichever printer it is given does the printing.
public class BoxOffice(ITicketPrinter printer)
{
    public void Sell(Ticket ticket) => printer.Print(ticket);
}
