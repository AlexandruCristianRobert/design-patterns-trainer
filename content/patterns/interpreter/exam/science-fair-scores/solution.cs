// The idea, plus the better of the build and the talk, plus 2, never more than 20.
var final = new Capped(20, new Added(new Mark("idea"), new Added(new Best(new Mark("build"), new Mark("talk")), new Half(new Bonus(5)))));

var volcano = new Entry("Volcano");
volcano.Give("idea", 8);
volcano.Give("build", 6);
volcano.Give("talk", 7);
var bee = new Entry("Robot bee");
bee.Give("idea", 9);
bee.Give("build", 9);
bee.Give("talk", 4);

Console.WriteLine($"Volcano: {final.Points(volcano)}");
Console.WriteLine($"Robot bee: {final.Points(bee)}");

// One project at the fair, with the points the judges gave it for each criterion.
public class Entry(string title)
{
    private readonly Dictionary<string, int> given = [];

    public string Title => title;
    public void Give(string criterion, int points) => given[criterion] = points;
    public int PointsFor(string criterion) => given.GetValueOrDefault(criterion);
}

// Every part of a scoring formula works out its own points for an entry.
public abstract class Score
{
    public abstract int Points(Entry entry);
}

public class Mark(string criterion) : Score
{
    public override int Points(Entry entry) => entry.PointsFor(criterion);
}

public class Bonus(int points) : Score
{
    public override int Points(Entry entry) => points;
}

public class Added(Score first, Score second) : Score
{
    public override int Points(Entry entry) => first.Points(entry) + second.Points(entry);
}

public class Best(Score first, Score second) : Score
{
    public override int Points(Entry entry) => Math.Max(first.Points(entry), second.Points(entry));
}

public class Half(Score score) : Score
{
    public override int Points(Entry entry) => score.Points(entry) / 2;
}

public class Capped(int most, Score score) : Score
{
    public override int Points(Entry entry) => Math.Min(most, score.Points(entry));
}
