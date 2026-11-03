var layout = new TrackLayout();
var history = new LayoutHistory(layout);
layout.Lay("straight");
layout.Lay("curve");
history.Checkpoint();
layout.Lay("points");
history.Checkpoint();
layout.Swap(0, "bridge");
Console.WriteLine($"now:  {layout.Show()}");
history.Undo();
Console.WriteLine($"undo: {layout.Show()}");
history.Undo();
Console.WriteLine($"undo: {layout.Show()}");
history.Redo();
Console.WriteLine($"redo: {layout.Show()}");

// What the history holds. It is empty, so the history can keep a layout but not read it.
public interface ISavedLayout
{
}

// The pieces of a model railway, laid one after the other.
public class TrackLayout
{
    private readonly List<string> pieces = [];

    public void Lay(string piece) => pieces.Add(piece);

    public void Lift()
    {
        if (pieces.Count > 0) pieces.RemoveAt(pieces.Count - 1);
    }

    public void Swap(int position, string piece) => pieces[position] = piece;

    public string Show() => pieces.Count == 0 ? "(no track)" : string.Join(" ", pieces);

    public ISavedLayout Save() => new SavedPieces([.. pieces]);

    public void Restore(ISavedLayout saved)
    {
        pieces.Clear();
        pieces.AddRange(((SavedPieces)saved).Pieces);
    }

    // Only TrackLayout can name it, so only TrackLayout reads the pieces.
    private sealed record SavedPieces(IReadOnlyList<string> Pieces) : ISavedLayout;
}

// Undo and redo over the layout's saved copies, without reading them.
public class LayoutHistory(TrackLayout layout)
{
    private readonly Stack<ISavedLayout> undo = new();
    private readonly Stack<ISavedLayout> redo = new();

    // Saves the layout as it is now. A new checkpoint makes the undone layouts unreachable, so redo is cleared.
    public void Checkpoint()
    {
        undo.Push(layout.Save());
        redo.Clear();
    }

    // Goes back to the last checkpoint, and keeps the layout as it was for redo.
    public void Undo()
    {
        if (undo.Count == 0) return;
        redo.Push(layout.Save());
        layout.Restore(undo.Pop());
    }

    // Goes forward again to the layout as it was before the last undo.
    public void Redo()
    {
        if (redo.Count == 0) return;
        undo.Push(layout.Save());
        layout.Restore(redo.Pop());
    }
}
