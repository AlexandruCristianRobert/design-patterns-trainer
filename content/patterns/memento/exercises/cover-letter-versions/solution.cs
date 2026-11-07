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
        panel.Keep(letter.Save());
        lines.Add(letter.Read());
        letter.AddParagraph("I have baked bread for five years.");
        panel.Keep(letter.Save());
        lines.Add(letter.Read());
        letter.SetGreeting("Hello,");
        letter.AddParagraph("I like bread.");
        lines.Add(letter.Read());
        letter.Restore(panel.Back());
        lines.Add(letter.Read());
        letter.Restore(panel.Back());
        lines.Add(letter.Read());
        return lines;
    }
}

// What the panel keeps. It is empty, so the panel can hold a version but not read it.
public interface ILetterVersion
{
}

// A cover letter: a greeting and some paragraphs. Only the letter sees its fields.
public class CoverLetter
{
    private string greeting = "Dear hiring team,";
    private readonly List<string> paragraphs = [];

    public void SetGreeting(string greeting) => this.greeting = greeting;

    public void AddParagraph(string text) => paragraphs.Add(text);

    // The whole letter on one line, such as "Dear hiring team, / I would like to apply.".
    public string Read() => string.Join(" / ", [greeting, .. paragraphs]);

    // The letter copies itself: the paragraphs go into a new array, so later edits do not reach the version.
    public ILetterVersion Save() => new Version(greeting, [.. paragraphs]);

    // Only the letter knows what a version holds, and it copies the paragraphs back.
    public void Restore(ILetterVersion version)
    {
        var saved = (Version)version;
        greeting = saved.Greeting;
        paragraphs.Clear();
        paragraphs.AddRange(saved.Paragraphs);
    }

    private sealed record Version(string Greeting, string[] Paragraphs) : ILetterVersion;
}

// Keeps earlier versions of the letter without reading them, and gives back the last one.
public class VersionsPanel
{
    private readonly Stack<ILetterVersion> versions = new();

    public void Keep(ILetterVersion version) => versions.Push(version);

    public ILetterVersion Back() => versions.Pop();
}
