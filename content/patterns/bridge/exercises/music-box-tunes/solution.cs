Console.WriteLine(new Lullaby(new MusicBox()).Play());
Console.WriteLine(new Scale(new Xylophone(), 3).Play());

// What every instrument can do: sound one note, or rest.
public abstract class Instrument
{
    public abstract string Note(string pitch);
    public abstract string Rest();
}

public class MusicBox : Instrument
{
    public override string Note(string pitch) => $"plink {pitch}";
    public override string Rest() => "...";
}

public class Xylophone : Instrument
{
    public override string Note(string pitch) => $"tok {pitch}";
    public override string Rest() => "-";
}

// A tune holds the instrument it is played on and decides only which notes come in which order.
public abstract class Tune(Instrument instrument)
{
    protected Instrument Instrument => instrument;

    public abstract string Play();
}

public class Lullaby(Instrument instrument) : Tune(instrument)
{
    public override string Play() => string.Join(" ",
        Instrument.Note("C"), Instrument.Note("E"), Instrument.Note("G"), Instrument.Rest(),
        Instrument.Note("G"), Instrument.Note("E"), Instrument.Note("C"));
}

public class Scale(Instrument instrument, int count) : Tune(instrument)
{
    private static readonly string[] Pitches = ["C", "D", "E", "F", "G", "A", "B"];

    public override string Play()
    {
        var sounds = Pitches.Take(count).Select(Instrument.Note).ToList();
        sounds.Add(Instrument.Rest());
        return string.Join(" ", sounds);
    }
}
