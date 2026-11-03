foreach (var show in new DomeShow[] { new EveningShow(), new SchoolShow(), new RelaxedShow() })
{
    foreach (var line in show.Run("The Moons of Jupiter"))
        Console.WriteLine(line);
    Console.WriteLine();
}

// Every show under the dome runs in the same steps, in the same order. Run is not virtual, so no kind of show can change it.
public abstract class DomeShow
{
    public List<string> Run(string programme) =>
    [
        "open the doors",
        Welcome(),
        Lights(),
        $"set the sound to {Volume()} %",
        $"play {programme}",
        "bring the lights up",
    ];

    // Each kind of show fills these in.
    protected abstract string Lights();
    protected abstract int Volume();

    // The welcome a kind of show may change. By default it is the short talk.
    protected virtual string Welcome() => "give a 5-minute welcome talk";
}

public class EveningShow : DomeShow
{
    protected override string Lights() => "turn the dome lights off";
    protected override int Volume() => 80;
}

public class SchoolShow : DomeShow
{
    protected override string Lights() => "turn the dome lights off";
    protected override int Volume() => 60;
    protected override string Welcome() => "give a welcome talk with a question round";
}

public class RelaxedShow : DomeShow
{
    protected override string Lights() => "dim the dome lights, but keep them on";
    protected override int Volume() => 40;
}
