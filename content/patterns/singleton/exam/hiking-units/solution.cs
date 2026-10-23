Console.WriteLine(TrailCard.Describe("Ridge loop", 16, TrailUnits.Current));
TrailUnits.Current.UseMiles(true);
Console.WriteLine(TrailCard.Describe("Ridge loop", 16, TrailUnits.Current));

public interface IDistanceUnits
{
    string Show(int km);
}

// The app's one choice of units. It holds state and is an IDistanceUnits, so it can be handed to a card.
public sealed class TrailUnits : IDistanceUnits
{
    private static readonly Lock gate = new();
    private static TrailUnits? current;

    public static TrailUnits Current
    {
        get
        {
            var seen = Volatile.Read(ref current);
            if (seen is not null) return seen;
            lock (gate)
            {
                current ??= new TrailUnits();
                return current;
            }
        }
    }

    private bool miles;

    private TrailUnits() { }

    public void UseMiles(bool on) => miles = on;

    public string Show(int km) => miles ? $"{km * 5 / 8} mi" : $"{km} km";
}

public static class TrailCard
{
    public static string Describe(string trail, int km, IDistanceUnits units) => $"{trail}: {units.Show(km)}";
}
