var plan = new RoomPlan();
plan.Place("sofa", 0, 0);
plan.Place("lamp", 4, 1);
var tryout = new Tryout(plan);
plan.Place("sofa", 3, 3);
plan.Remove("lamp");
Console.WriteLine($"trying:   {plan.Show()}");
tryout.PutBack();
Console.WriteLine($"put back: {plan.Show()}");

// What a tryout keeps. It is empty, so the tryout can hold a look but not read it.
public interface IRoomLook
{
}

// Where each piece of furniture stands in the room, on a grid of squares.
public class RoomPlan
{
    private readonly Dictionary<string, (int X, int Y)> spots = [];

    public void Place(string item, int x, int y) => spots[item] = (x, y);

    public void Remove(string item) => spots.Remove(item);

    public string Show() => spots.Count == 0
        ? "empty room"
        : string.Join("; ", spots.OrderBy(s => s.Key, StringComparer.Ordinal).Select(s => $"{s.Key} {s.Value.X},{s.Value.Y}"));

    // A new dictionary, so later moves do not reach the look.
    public IRoomLook Save() => new Look(new Dictionary<string, (int X, int Y)>(spots));

    // Copies the spots back into this same plan, so everyone holding the plan sees the room as it was.
    public void Restore(IRoomLook look)
    {
        spots.Clear();
        foreach (var (item, spot) in ((Look)look).Spots) spots[item] = spot;
    }

    private sealed record Look(IReadOnlyDictionary<string, (int X, int Y)> Spots) : IRoomLook;
}

// Remembers how the room looked when the tryout started, and can put it back as often as needed.
public class Tryout
{
    private readonly RoomPlan plan;
    private IRoomLook before;

    public Tryout(RoomPlan plan)
    {
        this.plan = plan;
        before = plan.Save();
    }

    public void PutBack() => plan.Restore(before);

    public void KeepChanges() => before = plan.Save();
}
