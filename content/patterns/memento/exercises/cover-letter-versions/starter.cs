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
        letter.RewriteParagraph(0, "I am writing about the baker job.");
        letter.AddParagraph("I have baked bread for five years.");
        letter.SetClosing("Best wishes,");
        panel.KeepVersion(letter);
        lines.Add(letter.Read());
        letter.SetGreeting("Hello,");
        letter.RewriteParagraph(1, "I like bread.");
        lines.Add(letter.Read());
        panel.GoBack(letter);
        lines.Add(letter.Read());
        panel.GoBack(letter);
        lines.Add(letter.Read());
        return lines;
    }
}

// A cover letter: a greeting, some paragraphs and a closing.
// Its fields are public only so that the versions panel can copy them.
public class CoverLetter
{
    public string Greeting = "Dear hiring team,";
    public List<string> Paragraphs = [];
    public string Closing = "Kind regards,";

    public void SetGreeting(string greeting) => Greeting = greeting;

    public void AddParagraph(string text) => Paragraphs.Add(text);

    public void RewriteParagraph(int index, string text) => Paragraphs[index] = text;

    public void SetClosing(string closing) => Closing = closing;

    // The whole letter on one line, such as "Dear hiring team, / I would like ... / Kind regards,".
    public string Read() => string.Join(" / ", [Greeting, .. Paragraphs, Closing]);
}

// Keeps earlier versions of the letter, so the writer can go back. It copies the letter's fields itself.
public class VersionsPanel
{
    private readonly List<string> greetings = [];
    private readonly List<List<string>> paragraphs = [];
    private readonly List<string> closings = [];

    public void KeepVersion(CoverLetter letter)
    {
        greetings.Add(letter.Greeting);
        paragraphs.Add(letter.Paragraphs.ToList());
        closings.Add(letter.Closing);
    }

    // Puts the letter back as the last kept version and forgets that version.
    public void GoBack(CoverLetter letter)
    {
        letter.Greeting = greetings[^1];
        letter.Paragraphs = paragraphs[^1].ToList();
        letter.Closing = closings[^1];
        greetings.RemoveAt(greetings.Count - 1);
        paragraphs.RemoveAt(paragraphs.Count - 1);
        closings.RemoveAt(closings.Count - 1);
    }
}
