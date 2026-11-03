// Each report is a visitor. It goes round the moorings, and the mooring classes never change for a new report.
var moorings = new List<IMooring>
{
    new YachtMooring("Ana", 12),
    new MotorboatMooring("Ben", 9, true),
    new HouseboatMooring("Cleo", 3),
};

var fees = new NightlyFees();
var dock = new DockList();
foreach (var mooring in moorings)
{
    mooring.Accept(fees);
    mooring.Accept(dock);
}
Console.WriteLine($"Tonight: {fees.Total} EUR");
foreach (var line in dock.Lines)
    Console.WriteLine(line);

// Every mooring has one method: it hands itself to a visitor. Leave as is.
public interface IMooring
{
    void Accept(IMooringVisitor visitor);
}

// One Visit for each mooring class. Leave as is.
public interface IMooringVisitor
{
    void Visit(YachtMooring mooring);
    void Visit(MotorboatMooring mooring);
    void Visit(HouseboatMooring mooring);
}

// Leave as is.
public class YachtMooring(string owner, int metres) : IMooring
{
    public string Owner { get; } = owner;
    public int Metres { get; } = metres;

    public void Accept(IMooringVisitor visitor) => visitor.Visit(this);
}

// Leave as is.
public class MotorboatMooring(string owner, int metres, bool shorePower) : IMooring
{
    public string Owner { get; } = owner;
    public int Metres { get; } = metres;
    public bool ShorePower { get; } = shorePower;

    public void Accept(IMooringVisitor visitor) => visitor.Visit(this);
}

public class HouseboatMooring(string owner, int berths) : IMooring
{
    public string Owner { get; } = owner;
    public int Berths { get; } = berths;

    public void Accept(IMooringVisitor visitor) => visitor.Visit(this);
}

// What tonight's boats pay. Leave as is.
public class NightlyFees : IMooringVisitor
{
    public int Total { get; private set; }

    public void Visit(YachtMooring mooring) => Total += 10 + 2 * mooring.Metres;
    public void Visit(MotorboatMooring mooring) => Total += 15 + 2 * mooring.Metres + (mooring.ShorePower ? 5 : 0);
    public void Visit(HouseboatMooring mooring) => Total += 15 * mooring.Berths;
}

// One line for each mooring, for the dock master.
public class DockList : IMooringVisitor
{
    public List<string> Lines { get; } = new();

    public void Visit(YachtMooring mooring) => Lines.Add($"{mooring.Owner}: yacht, {mooring.Metres} m");
    public void Visit(MotorboatMooring mooring) => Lines.Add($"{mooring.Owner}: motorboat, {mooring.Metres} m, {(mooring.ShorePower ? "shore power" : "no shore power")}");
    public void Visit(HouseboatMooring mooring) => Lines.Add($"{mooring.Owner}: houseboat, {mooring.Berths} berths, empty the tank");
}
