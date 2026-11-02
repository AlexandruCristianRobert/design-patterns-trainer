var draft = new AdDraft("Junior tester").City("Iasi").Salary(2800, 3400).Skill("Selenium");
var first = draft.Post();
draft.Skill("SQL");
var second = draft.Post();
Console.WriteLine(first.Text());
Console.WriteLine(second.Text());

var graduate = new AdDraft("Graduate developer").City("Cluj");
Presets.Graduate(graduate);
Console.WriteLine(graduate.Post().Text());

try
{
    new AdDraft("Data analyst").Salary(4000, 3000).Remote().Post();
}
catch (InvalidOperationException problem)
{
    Console.WriteLine($"rejected: {problem.Message}");
}

// A posted ad. Its text is fixed when it is posted.
public class JobAd(string text)
{
    public string Text() => text;
}

// Collects the recruiter's choices in any order; Post() checks them and writes the ad.
public class AdDraft(string title)
{
    private string? city;
    private bool remote;
    private (int Min, int Max)? salary;
    private readonly List<string> skills = [];

    public AdDraft City(string name) { city = name; return this; }
    public AdDraft Remote() { remote = true; return this; }
    public AdDraft Salary(int min, int max) { salary = (min, max); return this; }
    public AdDraft Skill(string name) { skills.Add(name); return this; }

    public JobAd Post()
    {
        if (!remote && city is null)
            throw new InvalidOperationException("An on-site job needs a city.");
        if (salary is { } s && s.Min > s.Max)
            throw new InvalidOperationException("The lowest salary is above the highest.");

        List<string> parts = [title, remote ? (city is null ? "remote" : $"remote, based in {city}") : city!];
        if (salary is { } range) parts.Add($"{range.Min}-{range.Max}");
        if (skills.Count > 0) parts.Add($"skills: {string.Join(", ", skills)}");
        return new JobAd(string.Join(" | ", parts));
    }
}

// A preset the recruiters reuse. It adds its choices to whichever draft it is handed.
public static class Presets
{
    public static void Graduate(AdDraft draft) =>
        draft.Salary(30000, 36000).Skill("C#").Skill("SQL").Remote();
}
