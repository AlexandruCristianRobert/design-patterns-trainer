var box = new KaraokeBox(new() { [7] = "Volare", [12] = "Dancing Queen", [31] = "Wonderwall" });
ISongPlayer player = new BoxPlayer(box);

player.Play("dancing queen");
Console.WriteLine($"now playing: {player.NowPlaying()} (box track {box.Playing()})");

// A guest presses buttons on the box itself; the party app still knows what is on.
box.Load(31);
box.Start();
Console.WriteLine($"now playing: {player.NowPlaying()}");

player.Stop();
Console.WriteLine($"now playing: \"{player.NowPlaying()}\"");

try
{
    player.Play("Bohemian Rhapsody");
}
catch (ArgumentException problem)
{
    Console.WriteLine($"refused: {problem.Message}");
}

// What the party app was written against.
public interface ISongPlayer
{
    void Play(string title);
    void Stop();
    string NowPlaying();
}

// Plays the part of the karaoke maker's library: songs by number. Echo, key change and scoring are left out.
public sealed class KaraokeBox(Dictionary<int, string> songbook)
{
    private int loaded;
    private bool running;

    public IReadOnlyDictionary<int, string> Songbook() => songbook;

    public void Load(int number)
    {
        if (!songbook.ContainsKey(number))
            throw new ArgumentException($"There is no song number {number}.");
        loaded = number;
        running = false;
    }

    public void Start() => running = loaded != 0;

    public void Halt() => running = false;

    public int Playing() => running ? loaded : 0;
}

// Lets the party app play songs by title on the box, which only knows numbers.
public class BoxPlayer(KaraokeBox box) : ISongPlayer
{
    public void Play(string title)
    {
        var song = box.Songbook().FirstOrDefault(s => string.Equals(s.Value, title, StringComparison.OrdinalIgnoreCase));
        if (song.Value is null)
            throw new ArgumentException($"The box has no song called {title}.");
        box.Load(song.Key);
        box.Start();
    }

    public void Stop() => box.Halt();

    // Asks the box every time, because guests can also press the box's own buttons.
    public string NowPlaying()
    {
        var number = box.Playing();
        return number == 0 ? "" : box.Songbook()[number];
    }
}
