var french = new OfflinePhrasebook(new() { ["hello"] = "bonjour", ["thank you"] = "merci" });

// Case is ignored before the memory, so "Hello" and "hello" share one remembered answer.
IPhrasebook app = new AnyCase(new Remembered(french));

foreach (var phrase in new[] { "Hello", "hello", "Thank You", "goodbye" })
    Console.WriteLine($"{phrase} -> {app.Translate(phrase)}");

public interface IPhrasebook
{
    string Translate(string phrase);
}

public class OfflinePhrasebook(Dictionary<string, string> phrases) : IPhrasebook
{
    public string Translate(string phrase) => phrases.TryGetValue(phrase, out var translation) ? translation : "?";
}

public class Remembered(IPhrasebook book) : IPhrasebook
{
    private readonly Dictionary<string, string> _answers = [];

    public string Translate(string phrase)
    {
        if (!_answers.TryGetValue(phrase, out var answer))
        {
            answer = book.Translate(phrase);
            _answers[phrase] = answer;
        }
        return answer;
    }
}

public class AnyCase(IPhrasebook book) : IPhrasebook
{
    public string Translate(string phrase) => book.Translate(phrase.ToLowerInvariant());
}
