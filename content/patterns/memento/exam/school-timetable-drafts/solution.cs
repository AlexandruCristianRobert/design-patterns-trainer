var timetable = new Timetable();
var shelf = new DraftShelf();
timetable.Set("Mon", 1, "maths");
timetable.Set("Mon", 3, "art");
shelf.Put("art early", timetable.Save());
timetable.Set("Mon", 1, "music");
Console.WriteLine($"Mon: {timetable.Day("Mon")}");
timetable.Restore(shelf.Take("art early")!);
Console.WriteLine($"Mon: {timetable.Day("Mon")}");

// What the shelf keeps. It is empty, so the shelf can hold a draft but not read it.
public interface ITimetableDraft
{
}

// A school week: five days of four periods, each with a lesson or "-".
public class Timetable
{
    private static readonly string[] Days = ["Mon", "Tue", "Wed", "Thu", "Fri"];

    private readonly string[][] slots = Days.Select(_ => new[] { "-", "-", "-", "-" }).ToArray();

    public void Set(string day, int period, string lesson) => slots[Array.IndexOf(Days, day)][period - 1] = lesson;

    public string Day(string day) => string.Join(", ", slots[Array.IndexOf(Days, day)]);

    // Copies every day's row, not only the outer array, so later changes do not reach the draft.
    public ITimetableDraft Save() => new Draft(slots.Select(row => row.ToArray()).ToArray());

    public void Restore(ITimetableDraft draft)
    {
        var saved = ((Draft)draft).Slots;
        for (var d = 0; d < slots.Length; d++) saved[d].CopyTo(slots[d], 0);
    }

    private sealed record Draft(string[][] Slots) : ITimetableDraft;
}

// Keeps the last three drafts by label, without reading them.
public class DraftShelf
{
    private readonly List<(string Label, ITimetableDraft Draft)> drafts = [];

    public IReadOnlyList<string> Labels => drafts.Select(d => d.Label).ToList();

    public void Put(string label, ITimetableDraft draft)
    {
        drafts.RemoveAll(d => d.Label == label);
        drafts.Add((label, draft));
        if (drafts.Count > 3) drafts.RemoveAt(0);
    }

    public ITimetableDraft? Take(string label) => drafts.FirstOrDefault(d => d.Label == label).Draft;
}
