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
        synth.AddNote("C");
        synth.AddNote("G");
        bank.Store(1, synth.Save());
        lines.Add(synth.Describe());
        synth.SetCutoff(90);
        bank.Store(2, synth.Save());
        lines.Add(synth.Describe());
        synth.Restore(bank.Recall(1));
        lines.Add(synth.Describe());
        synth.Restore(bank.Recall(2));
        lines.Add(synth.Describe());
        return lines;
    }
}

// A small synthesizer: a cutoff knob and a sequence of notes it plays in a loop.
public class Synth
{
    private int cutoff = 50;
    private List<string> notes = [];

    public void SetCutoff(int value) => cutoff = value;

    // Adds a note, such as "C", at the end of the sequence.
    public void AddNote(string note) => notes.Add(note);

    // Such as "cutoff 40, notes C G".
    public string Describe() => $"cutoff {cutoff}, notes {string.Join(" ", notes)}";

    public Patch Save() => new Patch { Cutoff = cutoff, Notes = notes };

    public void Restore(Patch patch)
    {
        cutoff = patch.Cutoff;
        notes = patch.Notes;
    }
}

// A saved sound. Anyone can read it and change it.
public class Patch
{
    public int Cutoff;
    public List<string> Notes = [];
}

// The synth's numbered patch slots. Storing in a used slot replaces what was there.
public class PatchBank
{
    private readonly Dictionary<int, Patch> slots = [];

    public void Store(int slot, Patch patch) => slots[slot] = patch;

    public Patch Recall(int slot) => slots[slot];
}
