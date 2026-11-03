var day = new SportsDay([new Sprint("Ana", 1), new LongJump("Ben", 310), new Relay("Red", 2), new Sprint("Cleo", 4)]);
Console.WriteLine($"points: {day.Points()}");
foreach (var line in day.Certificates())
    Console.WriteLine(line);

// A result hands itself to a visitor. Each visitor keeps its own result.
public interface IResult
{
    void Accept(ResultVisitor visitor);
}

public abstract class ResultVisitor
{
    public abstract void VisitSprint(Sprint sprint);
    public abstract void VisitLongJump(LongJump jump);
    public abstract void VisitRelay(Relay relay);
}

public class Sprint(string pupil, int place) : IResult
{
    public string Pupil { get; } = pupil;
    public int Place { get; } = place;

    public void Accept(ResultVisitor visitor) => visitor.VisitSprint(this);
}

public class LongJump(string pupil, int cm) : IResult
{
    public string Pupil { get; } = pupil;
    public int Cm { get; } = cm;

    public void Accept(ResultVisitor visitor) => visitor.VisitLongJump(this);
}

public class Relay(string team, int place) : IResult
{
    public string Team { get; } = team;
    public int Place { get; } = place;

    public void Accept(ResultVisitor visitor) => visitor.VisitRelay(this);
}

public class HousePoints : ResultVisitor
{
    public int Total { get; private set; }

    static int ForPlace(int place) => place switch { 1 => 5, 2 => 3, 3 => 1, _ => 0 };

    public override void VisitSprint(Sprint sprint) => Total += ForPlace(sprint.Place);
    public override void VisitLongJump(LongJump jump) => Total += jump.Cm / 50;
    public override void VisitRelay(Relay relay) => Total += 2 * ForPlace(relay.Place);
}

public class CertificateList : ResultVisitor
{
    public List<string> Lines { get; } = new();

    public override void VisitSprint(Sprint sprint)
    {
        if (sprint.Place == 1) Lines.Add($"{sprint.Pupil}: sprint winner");
    }

    public override void VisitLongJump(LongJump jump)
    {
        if (jump.Cm >= 300) Lines.Add($"{jump.Pupil}: long jump, {jump.Cm} cm");
    }

    public override void VisitRelay(Relay relay)
    {
        if (relay.Place == 1) Lines.Add($"{relay.Team}: relay winners");
    }
}

public class SportsDay(List<IResult> results)
{
    public int Points()
    {
        var points = new HousePoints();
        foreach (var result in results) result.Accept(points);
        return points.Total;
    }

    public List<string> Certificates()
    {
        var certificates = new CertificateList();
        foreach (var result in results) result.Accept(certificates);
        return certificates.Lines;
    }
}
