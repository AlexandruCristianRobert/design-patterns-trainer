Console.WriteLine($"Word file reads at start: {WordFile.Reads}");
var editor = new NoteEditor();
Console.WriteLine(editor.Mark("The lantren glows"));
WordList.Default.Learn("lantren");
Console.WriteLine(editor.Mark("The lantren glows"));
Console.WriteLine($"Word file reads: {WordFile.Reads}");

public static class WordFile
{
    public static int Reads { get; private set; }

    public static List<string> Read()
    {
        Reads++;
        return ["the", "lantern", "glows", "at", "night"];
    }
}

public sealed class WordList
{
    private static readonly WordList loaded = new();

    // An explicit static constructor: the runtime builds `loaded` exactly when the class is first used, not earlier.
    static WordList() { }

    public static WordList Default => loaded;

    private readonly HashSet<string> words = new(WordFile.Read(), StringComparer.OrdinalIgnoreCase);

    private WordList() { }

    public bool Knows(string word) => words.Contains(word);

    public void Learn(string word) => words.Add(word);
}

public class NoteEditor
{
    public string Mark(string text) =>
        string.Join(" ", text.Split(' ').Select(w => WordList.Default.Knows(w) ? w : $"[{w}]"));
}
