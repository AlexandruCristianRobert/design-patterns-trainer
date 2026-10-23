List<int> scores = [95, 82, 47, 61];

var card = new ReportCard(new Percentage());
Console.WriteLine(string.Join(" ", card.Grades(scores)));

card.Scheme = new Letters();
Console.WriteLine(string.Join(" ", card.Grades(scores)));

card.Scheme = new PassFail(passMark: 50);
Console.WriteLine(string.Join(" ", card.Grades(scores)));

public abstract class GradingScheme
{
    public abstract string Grade(int score);
}

public class ReportCard(GradingScheme scheme)
{
    // A school can move a course to another scheme, so the scheme can be replaced.
    public GradingScheme Scheme { get; set; } = scheme;

    public List<string> Grades(List<int> scores) => [.. scores.Select(Scheme.Grade)];
}

public class Percentage : GradingScheme
{
    public override string Grade(int score) => $"{score}%";
}

public class PassFail(int passMark) : GradingScheme
{
    public override string Grade(int score) => score >= passMark ? "pass" : "fail";
}

public class Letters : GradingScheme
{
    public override string Grade(int score) => score switch
    {
        >= 90 => "A",
        >= 80 => "B",
        >= 70 => "C",
        >= 60 => "D",
        _ => "F",
    };
}
