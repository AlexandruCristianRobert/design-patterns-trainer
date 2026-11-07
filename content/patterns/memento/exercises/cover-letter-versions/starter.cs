foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var letter = new CoverLetter();
        var panel = new VersionsPanel();
        var lines = new List<string>();
        letter.SetGreeting("Dear Ms Novak,");
        letter.AddParagraph("I would like to apply for the baker job.");
        panel.KeepVersion(letter);
        lines.Add(letter.Read());
        letter.AddParagraph("I have baked bread for five years.");
        panel.KeepVersion(letter);
        lines.Add(letter.Read());
        letter.SetGreeting("Hello,");
        letter.AddParagraph("I like bread.");
        lines.Add(letter.Read());
        panel.GoBack(letter);
        lines.Add(letter.Read());
        panel.GoBack(letter);
        lines.Add(letter.Read());
        return lines;
    }
}

// A cover letter: a greeting and some paragraphs.
// Its fields are public only so that the versions panel can copy them.
public class CoverLetter
{
    public string Greeting = "Dear hiring team,";
    public List<string> Paragraphs = [];

    public void SetGreeting(string greeting) => Greeting = greeting;

    public void AddParagraph(string text) => Paragraphs.Add(text);

    // The whole letter on one line, such as "Dear hiring team, / I would like to apply.".
    public string Read() => string.Join(" / ", [Greeting, .. Paragraphs]);
}

// Keeps earlier versions of the letter, so the writer can go back. It copies the letter's fields itself.
public class VersionsPanel
{
    private readonly Stack<(string Greeting, List<string> Paragraphs)> versions = new();

    public void KeepVersion(CoverLetter letter) => versions.Push((letter.Greeting, [.. letter.Paragraphs]));

    // Puts the letter back as the last kept version and forgets that version.
    public void GoBack(CoverLetter letter)
    {
        var (greeting, paragraphs) = versions.Pop();
        letter.Greeting = greeting;
        letter.Paragraphs = paragraphs;
    }
}
