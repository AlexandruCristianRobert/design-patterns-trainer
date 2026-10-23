foreach (var instrument in new Instrument[] { new Guitar(), new Violin(), new Ukulele() })
    Console.WriteLine(instrument.TuneUp());

// The practice screen shows the tuner on its own.
var tuner = new Violin().MakeTuner();
Console.WriteLine($"on screen: {tuner.Tool}, notes {string.Join(" ", tuner.Notes)}");

public interface ITuner
{
    // The notes of the open strings, from the lowest string to the highest.
    List<string> Notes { get; }

    // What the student tunes with.
    string Tool { get; }
}

public class GuitarTuner : ITuner
{
    public List<string> Notes { get; } = ["E", "A", "D", "G", "B", "E"];
    public string Tool => "clip-on tuner";
}

public class ViolinTuner : ITuner
{
    public List<string> Notes { get; } = ["G", "D", "A", "E"];
    public string Tool => "tuning fork";
}

public class UkuleleTuner : ITuner
{
    public List<string> Notes { get; } = ["G", "C", "E", "A"];
    public string Tool => "phone app";
}

public abstract class Instrument
{
    public abstract string Name { get; }

    // Each instrument decides which tuner it is tuned with.
    public abstract ITuner MakeTuner();

    public string TuneUp()
    {
        var tuner = MakeTuner();
        return $"{Name}: {tuner.Notes.Count} strings, {string.Join(" ", tuner.Notes)}, with a {tuner.Tool}";
    }
}

public class Guitar : Instrument
{
    public override string Name => "guitar";
    public override ITuner MakeTuner() => new GuitarTuner();
}

public class Violin : Instrument
{
    public override string Name => "violin";
    public override ITuner MakeTuner() => new ViolinTuner();
}

public class Ukulele : Instrument
{
    public override string Name => "ukulele";
    public override ITuner MakeTuner() => new UkuleleTuner();
}
