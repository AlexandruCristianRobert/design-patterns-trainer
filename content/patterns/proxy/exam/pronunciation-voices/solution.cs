IVoice voice = new CachedVoice("Spanish", signedIn: true);
Console.WriteLine($"Connections: {VoiceServer.Connections}");
Console.WriteLine(voice.Say("hola"));
Console.WriteLine(voice.Say("hola"));
Console.WriteLine(voice.Say("gracias"));
Console.WriteLine($"Connections: {VoiceServer.Connections}, requests: {VoiceServer.Requests}");
Console.WriteLine(new CachedVoice("French", signedIn: false).Say("merci"));

public interface IVoice
{
    string Say(string word);
}

// The real voice server. Connecting is slow, and every request costs money.
public class VoiceServer : IVoice
{
    public static int Connections { get; private set; }
    public static int Requests { get; private set; }

    private readonly string language;

    public VoiceServer(string language)
    {
        this.language = language;
        Connections++;
    }

    public string Say(string word)
    {
        Requests++;
        return $"{language} voice: {word}";
    }
}

// Controls access to one server: signed-in learners only, connected on the first word,
// and every word asked from the server once.
public class CachedVoice(string language, bool signedIn) : IVoice
{
    private VoiceServer? server;
    private readonly Dictionary<string, string> heard = [];

    public string Say(string word)
    {
        if (!signedIn)
            return $"Sign in to hear {word}";

        if (heard.TryGetValue(word, out var known))
            return known;

        server ??= new VoiceServer(language);
        return heard[word] = server.Say(word);
    }
}
