var staff = new RatingSurvey("Staff survey", 5);
staff.Questions.Add("How was lunch?");
staff.Questions.Add("How easy was parking?");

var desk = new SurveyDesk();
var spring = desk.Reuse(staff, "Spring staff survey");
spring.Questions.Add("Would you join a running club?");
spring.Footer.Text = "See you in spring!";
Console.WriteLine(staff.Describe());
Console.WriteLine(spring.Describe());

var party = new YesNoSurvey("Summer party");
party.Questions.Add("Are you coming?");
var late = desk.Reuse(party, "Summer party, late replies");
late.Questions.Add("Are you bringing a guest?");
Console.WriteLine(party.Describe());
Console.WriteLine(late.Describe());

// The thank-you line at the bottom of a survey. A survey holds it as a separate object.
public class Footer(string text)
{
    public string Text { get; set; } = text;
}

// Every survey can make a copy of itself. The desk only ever sees ISurvey.
public interface ISurvey
{
    string Title { get; set; }
    List<string> Questions { get; }
    Footer Footer { get; }
    string Describe();
    ISurvey Clone();
}

public class RatingSurvey : ISurvey
{
    private readonly int scale;

    public RatingSurvey(string title, int scale)
    {
        Title = title;
        this.scale = scale;
    }

    public string Title { get; set; }
    public List<string> Questions { get; private set; } = [];
    public Footer Footer { get; private set; } = new("Thank you!");

    public string Describe() => $"{Title} (rate 1-{scale}): {string.Join(" | ", Questions)} / {Footer.Text}";

    // A copy written by hand: the same settings, plus a question list and a footer of its own.
    public ISurvey Clone()
    {
        var copy = new RatingSurvey(Title, scale);
        copy.Questions.AddRange(Questions);
        copy.Footer.Text = Footer.Text;
        return copy;
    }
}

public class YesNoSurvey : ISurvey
{
    public YesNoSurvey(string title) => Title = title;

    public string Title { get; set; }
    public List<string> Questions { get; private set; } = [];
    public Footer Footer { get; private set; } = new("Thank you!");

    public string Describe() => $"{Title} (yes/no): {string.Join(" | ", Questions)} / {Footer.Text}";

    public ISurvey Clone()
    {
        // MemberwiseClone copies the fields one by one, so the list and the footer
        // would still be shared. Replace both with copies of their own.
        var copy = (YesNoSurvey)MemberwiseClone();
        copy.Questions = [.. Questions];
        copy.Footer = new Footer(Footer.Text);
        return copy;
    }
}

// Reuses an existing survey under a new title. It works for any kind of survey.
public class SurveyDesk
{
    public ISurvey Reuse(ISurvey survey, string title)
    {
        var copy = survey.Clone();
        copy.Title = title;
        return copy;
    }
}
