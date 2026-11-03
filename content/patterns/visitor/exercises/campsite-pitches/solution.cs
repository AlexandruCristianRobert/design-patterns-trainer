// Each report is a visitor. It goes round the pitches, and the pitch classes never change for a new report.
var pitches = new List<IPitch>
{
    new TentPitch("Ana", 2),
    new CaravanPitch("Ben", 4, true),
    new YurtPitch("Cleo", 3),
};

var fees = new NightlyFees();
var arrivals = new ArrivalList();
foreach (var pitch in pitches)
{
    pitch.Accept(fees);
    pitch.Accept(arrivals);
}
Console.WriteLine($"Tonight: {fees.Total} EUR");
foreach (var line in arrivals.Lines)
    Console.WriteLine(line);

// Every pitch has one method: it hands itself to a visitor. Leave as is.
public interface IPitch
{
    void Accept(IPitchVisitor visitor);
}

// One Visit for each pitch class. Leave as is.
public interface IPitchVisitor
{
    void Visit(TentPitch pitch);
    void Visit(CaravanPitch pitch);
    void Visit(YurtPitch pitch);
}

// Leave as is.
public class TentPitch(string guest, int people) : IPitch
{
    public string Guest { get; } = guest;
    public int People { get; } = people;

    public void Accept(IPitchVisitor visitor) => visitor.Visit(this);
}

// Leave as is.
public class CaravanPitch(string guest, int people, bool hookUp) : IPitch
{
    public string Guest { get; } = guest;
    public int People { get; } = people;
    public bool HookUp { get; } = hookUp;

    public void Accept(IPitchVisitor visitor) => visitor.Visit(this);
}

public class YurtPitch(string guest, int beds) : IPitch
{
    public string Guest { get; } = guest;
    public int Beds { get; } = beds;

    public void Accept(IPitchVisitor visitor) => visitor.Visit(this);
}

// What tonight's guests pay. Leave as is.
public class NightlyFees : IPitchVisitor
{
    public int Total { get; private set; }

    public void Visit(TentPitch pitch) => Total += 8 + 4 * pitch.People;
    public void Visit(CaravanPitch pitch) => Total += 15 + 4 * pitch.People + (pitch.HookUp ? 5 : 0);
    public void Visit(YurtPitch pitch) => Total += 15 * pitch.Beds;
}

// One line for each pitch, for the warden at the gate.
public class ArrivalList : IPitchVisitor
{
    public List<string> Lines { get; } = new();

    public void Visit(TentPitch pitch) => Lines.Add($"{pitch.Guest}: tent, {pitch.People} people");
    public void Visit(CaravanPitch pitch) => Lines.Add($"{pitch.Guest}: caravan, {pitch.People} people, {(pitch.HookUp ? "hook-up" : "no hook-up")}");
    public void Visit(YurtPitch pitch) => Lines.Add($"{pitch.Guest}: yurt, make up {pitch.Beds} beds");
}
