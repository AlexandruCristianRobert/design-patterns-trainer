var screen = new PcConfigurator()
    .Memory(32)
    .Board("B650 Tomahawk", "AM5")
    .Cpu("Ryzen 5 7600", "AM5");
var first = screen.Confirm();
screen.Memory(64);
var second = screen.Confirm();
Console.WriteLine(first.Summary());
Console.WriteLine(second.Summary());

try
{
    new PcConfigurator().Cpu("Core i5-14400", "LGA1700").Board("B650 Tomahawk", "AM5").Confirm();
}
catch (InvalidOperationException problem)
{
    Console.WriteLine($"rejected: {problem.Message}");
}

// A confirmed PC. Only Confirm() creates one, so every PC has passed the socket check.
public class Computer
{
    private readonly string summary;

    internal Computer(string summary) => this.summary = summary;

    public string Summary() => summary;
}

// Holds the customer's picks in any order; Confirm() checks that they fit together.
public class PcConfigurator
{
    private (string Model, string Socket)? cpu;
    private (string Model, string Socket)? board;
    private int memory = 8;

    public PcConfigurator Cpu(string model, string socket) { cpu = (model, socket); return this; }
    public PcConfigurator Board(string model, string socket) { board = (model, socket); return this; }
    public PcConfigurator Memory(int gigabytes) { memory = gigabytes; return this; }

    public Computer Confirm()
    {
        if (cpu is not { } c) throw new InvalidOperationException("Pick a CPU.");
        if (board is not { } b) throw new InvalidOperationException("Pick a board.");
        if (c.Socket != b.Socket)
            throw new InvalidOperationException($"A {c.Socket} CPU does not fit a {b.Socket} board.");
        return new Computer($"{c.Model} on {b.Model}, {c.Socket}, {memory} GB");
    }
}
