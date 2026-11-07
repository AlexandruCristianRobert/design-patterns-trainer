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
    private readonly List<string> notes = [];

    public void SetCutoff(int value) => cutoff = value;

    // Adds a note, such as "C", at the end of the sequence.
    public void AddNote(string note) => notes.Add(note);

    // Such as "cutoff 40, notes C G".
    public string Describe() => $"cutoff {cutoff}, notes {string.Join(" ", notes)}";

    // The patch gets its own copy of the notes, so later changes do not reach it.
    public Patch Save() => new(cutoff, [.. notes]);

    // Copies the notes back, so the patch stays as it was and can be recalled again.
    public void Restore(Patch patch)
    {
        cutoff = patch.Cutoff;
        notes.Clear();
        notes.AddRange(patch.Notes);
    }
}

// A saved sound. Its members are internal and read-only: the bank can keep it, and only the synth reads it.
public sealed class Patch
{
    internal Patch(int cutoff, string[] notes)
    {
        Cutoff = cutoff;
        Notes = notes;
    }

    internal int Cutoff { get; }
    internal string[] Notes { get; }
}

// The synth's numbered patch slots. Storing in a used slot replaces what was there.
public class PatchBank
{
    private readonly Dictionary<int, Patch> slots = [];

    public void Store(int slot, Patch patch) => slots[slot] = patch;

    public Patch Recall(int slot) => slots[slot];
}
