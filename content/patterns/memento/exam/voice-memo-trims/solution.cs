var memo = new VoiceMemo();
foreach (var level in new[] { 10, 20, 50, 5 }) memo.Record(level);
var editor = new MemoEditor(memo);
editor.Normalize();
Console.WriteLine(memo.Show());
editor.Silence(3, 1);
Console.WriteLine(memo.Show());
editor.Undo();
editor.Undo();
Console.WriteLine(memo.Show());

// What the editor keeps. It is empty, so the editor can hold a point but not read it.
public interface IUndoPoint
{
}

// A voice memo: one loudness level, from 0 to 100, for each tenth of a second.
public class VoiceMemo
{
    private readonly List<int> levels = [];

    public void Record(int level) => levels.Add(level);

    // The loudest level becomes 100, and the others grow by the same factor, rounded down.
    public void Normalize()
    {
        var loudest = levels.DefaultIfEmpty(0).Max();
        if (loudest == 0) return;
        for (var i = 0; i < levels.Count; i++) levels[i] = levels[i] * 100 / loudest;
    }

    public void Silence(int start, int count)
    {
        for (var i = start; i < Math.Min(start + count, levels.Count); i++) levels[i] = 0;
    }

    public void Cut(int start, int count) =>
        levels.RemoveRange(start, Math.Max(0, Math.Min(count, levels.Count - start)));

    public string Show() => levels.Count == 0 ? "(empty)" : string.Join(" ", levels);

    // A copy of the levels, so later edits do not reach the point.
    public IUndoPoint Save() => new Point([.. levels]);

    public void Restore(IUndoPoint point)
    {
        levels.Clear();
        levels.AddRange(((Point)point).Levels);
    }

    private sealed class Point(int[] levels) : IUndoPoint
    {
        public int[] Levels { get; } = levels;
    }
}

// Makes the edits, and keeps the memo as it was before each one, so that it can go back.
public class MemoEditor(VoiceMemo memo)
{
    private readonly Stack<IUndoPoint> points = new();

    public void Normalize()
    {
        points.Push(memo.Save());
        memo.Normalize();
    }

    public void Silence(int start, int count)
    {
        points.Push(memo.Save());
        memo.Silence(start, count);
    }

    public void Cut(int start, int count)
    {
        points.Push(memo.Save());
        memo.Cut(start, count);
    }

    public void Undo()
    {
        if (points.Count > 0) memo.Restore(points.Pop());
    }
}
