// The board makes and reads its own checkpoints. The history only keeps them.
var board = new SudokuBoard();
var history = new CheckpointHistory();
board.Place(0, 4);
board.Place(1, 7);
history.Push(board.Save());
board.Place(2, 9);
board.Place(3, 9);
Console.WriteLine($"guessing: {board.Line()}");
board.Restore(history.Pop());
Console.WriteLine($"restored: {board.Line()}");

public interface ICheckpoint
{
}

public class SudokuBoard
{
    private readonly int[] cells = new int[9];

    public void Place(int cell, int digit) => cells[cell] = digit;

    public string Line() => string.Join(" ", cells.Select(c => c == 0 ? "." : c.ToString()));

    public ICheckpoint Save() => new BoardCheckpoint(cells.ToArray());

    public void Restore(ICheckpoint checkpoint)
    {
        var saved = (BoardCheckpoint)checkpoint;
        saved.Cells.CopyTo(cells, 0);
    }

    private sealed class BoardCheckpoint(int[] cells) : ICheckpoint
    {
        public int[] Cells { get; } = cells;
    }
}

public class CheckpointHistory
{
    private readonly List<ICheckpoint> saved = [];

    public int Count => saved.Count;

    public void Push(ICheckpoint checkpoint) => saved.Add(checkpoint);

    public ICheckpoint Pop()
    {
        var last = saved[^1];
        saved.RemoveAt(saved.Count - 1);
        return last;
    }
}
