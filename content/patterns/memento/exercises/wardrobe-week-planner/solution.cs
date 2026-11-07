var plan = new WeekPlan();
var history = new PlanHistory();
plan.Wear("Mon", "jeans");
plan.Wear("Fri", "suit");
history.Keep(plan.Save());
plan.Wear("Mon", "shorts");
plan.Wear("Sat", "kilt");
Console.WriteLine($"trying:  Mon {plan.OutfitOn("Mon")}, Sat {plan.OutfitOn("Sat")}");
plan.Restore(history.Back());
Console.WriteLine($"back to: Mon {plan.OutfitOn("Mon")}, Sat {plan.OutfitOn("Sat")}");

// What the history holds. It is empty, so the history can keep a week but not read it.
public interface ISavedWeek
{
}

// The outfit planned for each day of the week.
public class WeekPlan
{
    private readonly Dictionary<string, string> outfits = [];

    public void Wear(string day, string outfit) => outfits[day] = outfit;

    public string OutfitOn(string day) => outfits.GetValueOrDefault(day, "nothing");

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
internal sealed class SavedWeek(Dictionary<string, string> outfits) : ISavedWeek
{
    public Dictionary<string, string> Outfits { get; } = outfits;
}

// Keeps the saved weeks, the last one on top, without reading them.
public class PlanHistory
{
    private readonly Stack<ISavedWeek> kept = new();

    public void Keep(ISavedWeek saved) => kept.Push(saved);

    public ISavedWeek Back() => kept.Pop();
}
