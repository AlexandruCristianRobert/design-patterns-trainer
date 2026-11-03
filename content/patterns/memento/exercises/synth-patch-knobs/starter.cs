foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var synth = new Synth();
        var bank = new PatchBank();
        var lines = new List<string>();
        synth.SetCutoff(40);
        synth.SetStep(0, "C");
        synth.SetStep(2, "G");
        bank.Store(1, synth.Save());
        lines.Add(synth.Describe());
        synth.SetCutoff(90);
        synth.SetResonance(70);
        bank.Store(2, synth.Save());
        lines.Add(synth.Describe());
        synth.Restore(bank.Recall(1));
        lines.Add(synth.Describe());
        synth.Restore(bank.Recall(2));
        lines.Add(synth.Describe());
        return lines;
    }
}

// A small synthesizer: two knobs and a sequence of eight steps, each a note or "-" for a rest.
public class Synth
{
    private int cutoff = 50;
    private int resonance = 0;
    private string[] steps = ["-", "-", "-", "-", "-", "-", "-", "-"];

    // Each knob goes from 0 to 100.
    public void SetCutoff(int value) => cutoff = Math.Clamp(value, 0, 100);

    public void SetResonance(int value) => resonance = Math.Clamp(value, 0, 100);

    // Sets one of the eight steps, counting from 0, to a note such as "C", or to "-".
    public void SetStep(int step, string note) => steps[step] = note;

    // Such as "cutoff 40, resonance 0, steps C - G - - - - -".
    public string Describe() => $"cutoff {cutoff}, resonance {resonance}, steps {string.Join(" ", steps)}";

    public Patch Save() => new Patch { Cutoff = cutoff, Resonance = resonance, Steps = steps };

    public void Restore(Patch patch)
    {
        cutoff = patch.Cutoff;
        resonance = patch.Resonance;
        steps = patch.Steps;
    }
}

// A saved sound. Anyone can read it and change it.
public class Patch
{
    public int Cutoff;
    public int Resonance;
    public string[] Steps = [];
}

// The synth's numbered patch slots. Storing in a used slot replaces what was there.
public class PatchBank
{
    private readonly Dictionary<int, Patch> slots = [];

    public void Store(int slot, Patch patch) => slots[slot] = patch;

    public Patch Recall(int slot) => slots[slot];
}
