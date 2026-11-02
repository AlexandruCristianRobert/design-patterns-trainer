var stack = new CueStack();
var opening = new WashCue("amber", 3);
opening.Levels["front"] = 80;
opening.Levels["back"] = 40;
stack.Add(opening);

// The next cue starts as a copy of the opening and is then adjusted.
var dusk = stack.CopyOf(0);
dusk.Levels["front"] = 30;
dusk.Fade.Seconds = 8;
Console.WriteLine(opening.Describe());
Console.WriteLine(dusk.Describe());

var solo = new SpotCue("Hamlet", 1);
solo.Levels["follow"] = 100;
stack.Add(solo);
Console.WriteLine(stack.CopyOf(2).Describe());
Console.WriteLine($"{stack.Count} cues");

// How long a cue takes to fade in. A cue holds it as a separate object.
public class Fade(int seconds)
{
    public int Seconds { get; set; } = seconds;
}

// Every cue can copy itself. The stack only ever sees ICue.
public interface ICue
{
    Dictionary<string, int> Levels { get; }
    Fade Fade { get; }
    string Describe();
    ICue Clone();
}

public static class Lamps
{
    // The lamps in alphabetical order, each with its level, or "no lamps".
    public static string Describe(Dictionary<string, int> levels) =>
        levels.Count == 0 ? "no lamps"
        : string.Join(", ", levels.OrderBy(l => l.Key, StringComparer.Ordinal).Select(l => $"{l.Key} {l.Value}%"));
}

public class WashCue : ICue
{
    private readonly string colour;

    public WashCue(string colour, int fadeSeconds)
    {
        this.colour = colour;
        Fade = new Fade(fadeSeconds);
    }

    // A copy constructor: the same colour, plus levels and a fade of its own.
    private WashCue(WashCue other)
    {
        colour = other.colour;
        Levels = new Dictionary<string, int>(other.Levels);
        Fade = new Fade(other.Fade.Seconds);
    }

    public Dictionary<string, int> Levels { get; } = [];
    public Fade Fade { get; }

    public string Describe() => $"{colour} wash, {Fade.Seconds} s fade: {Lamps.Describe(Levels)}";

    public ICue Clone() => new WashCue(this);
}

public class SpotCue : ICue
{
    private readonly string performer;

    public SpotCue(string performer, int fadeSeconds)
    {
        this.performer = performer;
        Fade = new Fade(fadeSeconds);
    }

    public Dictionary<string, int> Levels { get; private set; } = [];
    public Fade Fade { get; private set; }

    public string Describe() => $"spot on {performer}, {Fade.Seconds} s fade: {Lamps.Describe(Levels)}";

    // MemberwiseClone copies each field as it is, so the levels and the fade are replaced with copies.
    public ICue Clone()
    {
        var copy = (SpotCue)MemberwiseClone();
        copy.Levels = new Dictionary<string, int>(Levels);
        copy.Fade = new Fade(Fade.Seconds);
        return copy;
    }
}

// The cues of a show in order. A new cue often starts as a copy of an earlier one.
public class CueStack
{
    private readonly List<ICue> cues = [];

    public int Count => cues.Count;

    public void Add(ICue cue) => cues.Add(cue);

    public ICue CopyOf(int index)
    {
        var copy = cues[index].Clone();
        cues.Add(copy);
        return copy;
    }
}
