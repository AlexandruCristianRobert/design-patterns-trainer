var plan = new WeekPlan();
var history = new PlanHistory();
plan.Wear("Mon", "jeans");
plan.Wear("Fri", "suit");
history.Keep(plan.Save());
plan.Wear("Mon", "shorts");
plan.Clear("Fri");
Console.WriteLine($"trying:  {plan.Show()}");
plan.Restore(history.Back()!);
Console.WriteLine($"back to: {plan.Show()}");

// What the history holds. It is empty, so the history can keep a week but not read it.
public interface ISavedWeek
{
}

// The outfits planned for each day of the week.
public class WeekPlan
{
    private static readonly string[] Days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    private readonly Dictionary<string, string> outfits = [];

    public void Wear(string day, string outfit) => outfits[day] = outfit;

    public void Clear(string day) => outfits.Remove(day);

    // The planned days in week order, such as "Mon jeans, Fri suit", or "nothing planned".
    public string Show()
    {
        var planned = Days.Where(outfits.ContainsKey).Select(d => $"{d} {outfits[d]}").ToList();
        return planned.Count == 0 ? "nothing planned" : string.Join(", ", planned);
    }

    // A new dictionary, so later changes to the plan do not reach the saved week.
    public ISavedWeek Save() => new SavedWeek(new Dictionary<string, string>(outfits));

    // Copies the saved outfits back, so the saved week stays as it was.
    public void Restore(ISavedWeek saved)
    {
        outfits.Clear();
        foreach (var (day, outfit) in ((SavedWeek)saved).Outfits) outfits[day] = outfit;
    }
}

// The saved week. It is internal: code in this project could name it, but only WeekPlan uses it.
internal sealed class SavedWeek(IReadOnlyDictionary<string, string> outfits) : ISavedWeek
{
    public IReadOnlyDictionary<string, string> Outfits { get; } = outfits;
}

// Keeps the last five saved weeks, without reading them.
public class PlanHistory
{
    private const int Limit = 5;
    private readonly List<ISavedWeek> kept = [];

    public int Count => kept.Count;

    public void Keep(ISavedWeek saved)
    {
        kept.Add(saved);
        if (kept.Count > Limit) kept.RemoveAt(0);
    }

    // The last kept week, which it forgets, or null when none is left.
    public ISavedWeek? Back()
    {
        if (kept.Count == 0) return null;
        var last = kept[^1];
        kept.RemoveAt(kept.Count - 1);
        return last;
    }
}
