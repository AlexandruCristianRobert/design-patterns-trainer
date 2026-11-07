var layout = new TrackLayout();
var history = new LayoutHistory(layout);
layout.Lay("straight");
history.Checkpoint();
layout.Lay("curve");
history.Checkpoint();
layout.Lay("points");
Console.WriteLine($"now:  {layout.Show()}");
history.Undo();
Console.WriteLine($"undo: {layout.Show()}");
history.Undo();
Console.WriteLine($"undo: {layout.Show()}");

// What the history holds. It is empty, so the history can keep a layout but not read it.
public interface ISavedLayout
{
}

// The pieces of a model railway, laid one after the other.
public class TrackLayout
{
    private readonly List<string> pieces = [];

    public void Lay(string piece) => pieces.Add(piece);

    public string Show() => string.Join(" ", pieces);

    public ISavedLayout Save() => new SavedPieces([.. pieces]);

    public void Restore(ISavedLayout saved)
    {
        pieces.Clear();
        pieces.AddRange(((SavedPieces)saved).Pieces);
    }

    // Only TrackLayout can name it, so only TrackLayout reads the pieces.
    private sealed record SavedPieces(string[] Pieces) : ISavedLayout;
}

// Undo over the layout's saved copies, without reading them.
public class LayoutHistory(TrackLayout layout)
{
    private readonly Stack<ISavedLayout> checkpoints = new();

    public void Checkpoint() => checkpoints.Push(layout.Save());

    public void Undo() => layout.Restore(checkpoints.Pop());
}
