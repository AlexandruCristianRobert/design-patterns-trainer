// The bracelet saves itself and reads its own saved copies. The history only keeps them.
var bracelet = new Bracelet();
var history = new DesignHistory();
bracelet.Add("red");
bracelet.Add("blue");
history.Keep(bracelet.Save());
bracelet.Recolour(0, "gold");
bracelet.Add("white");
Console.WriteLine($"trying:   {bracelet.Show()}");
bracelet.Restore(history.TakeLast());
Console.WriteLine($"restored: {bracelet.Show()}");

// What the history holds. It is empty on purpose: nobody but the bracelet can see what is inside. Leave as is.
public interface ISavedBracelet
{
}

// A bracelet of coloured beads, from the clasp onwards.
public class Bracelet
{
    private readonly List<string> beads = [];

    // Threads a bead of this colour at the end. Leave as is.
    public void Add(string colour) => beads.Add(colour);

    // Swaps the bead at this position, counting from 0, for one of another colour. Leave as is.
    public void Recolour(int position, string colour) => beads[position] = colour;

    // The beads in order, such as "red blue red", or "(no beads)". Leave as is.
    public string Show() => beads.Count == 0 ? "(no beads)" : string.Join(" ", beads);

    public ISavedBracelet Save()
    {
        // TODO: copy the beads into a new SavedBeads and return it.
        throw new NotImplementedException();
    }

    public void Restore(ISavedBracelet saved)
    {
        // TODO: cast saved back to SavedBeads and put its beads back into this bracelet.
    }

    // TODO: hold the copy of the beads. It is private and nested here, so only Bracelet can name it.
    private sealed class SavedBeads : ISavedBracelet
    {
    }
}

// Keeps the saved bracelets, the last one on top, without looking inside. Leave as is.
public class DesignHistory
{
    private readonly Stack<ISavedBracelet> kept = new();

    public int Count => kept.Count;

    public void Keep(ISavedBracelet saved) => kept.Push(saved);

    public ISavedBracelet TakeLast() => kept.Pop();
}
