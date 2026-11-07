var day = new SportsDay([new Sprint("Ana", 1), new LongJump("Ben", 4), new Sprint("Cleo", 3)]);
Console.WriteLine($"points: {day.Points()}");
foreach (var line in day.Certificates())
    Console.WriteLine(line);

// A result hands itself to a visitor, which returns its answer for that result.
public interface IResult
{
    T Accept<T>(IResultVisitor<T> visitor);
}

public interface IResultVisitor<T>
{
    T VisitSprint(Sprint sprint);
    T VisitLongJump(LongJump jump);
}

public class Sprint(string pupil, int place) : IResult
{
    public string Pupil { get; } = pupil;
    public int Place { get; } = place;

    public T Accept<T>(IResultVisitor<T> visitor) => visitor.VisitSprint(this);
}

public class LongJump(string pupil, int metres) : IResult
{
    public string Pupil { get; } = pupil;
    public int Metres { get; } = metres;

    public T Accept<T>(IResultVisitor<T> visitor) => visitor.VisitLongJump(this);
}

// The points one result earns.
public class HousePoints : IResultVisitor<int>
{
    public int VisitSprint(Sprint sprint) => sprint.Place == 1 ? 5 : 1;
    public int VisitLongJump(LongJump jump) => jump.Metres;
}

// The certificate of one result.
public class CertificateLine : IResultVisitor<string>
{
    public string VisitSprint(Sprint sprint) => $"{sprint.Pupil}: sprint, place {sprint.Place}";
    public string VisitLongJump(LongJump jump) => $"{jump.Pupil}: long jump, {jump.Metres} m";
}

public class SportsDay(List<IResult> results)
{
    public int Points() => results.Sum(result => result.Accept(new HousePoints()));

    public List<string> Certificates() => results.Select(result => result.Accept(new CertificateLine())).ToList();
}
