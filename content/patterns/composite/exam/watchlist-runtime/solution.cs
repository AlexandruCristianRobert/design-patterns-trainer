var heist = new Folder("Heist films");
heist.Add(new Film("Rififi", 118));
heist.Add(new Film("Thief", 123));

var weekend = new Folder("Weekend");
weekend.Add(new Film("Paddington 2", 103));
weekend.Add(heist);
weekend.Add(new Folder("Maybe later"));

IWatchEntry list = weekend;
Console.WriteLine($"{list.Titles().Count} films, {list.Minutes() / 60} h {list.Minutes() % 60} min");
Console.WriteLine(string.Join(", ", list.Titles()));

// Anything on the watchlist: one film, or a folder of films and folders.
public interface IWatchEntry
{
    int Minutes();
    List<string> Titles();
}

// A film answers for itself.
public class Film(string title, int minutes) : IWatchEntry
{
    public int Minutes() => minutes;
    public List<string> Titles() => [title];
}

// A folder asks everything in it and combines the answers, so folders can sit inside folders.
public class Folder(string name) : IWatchEntry
{
    private readonly List<IWatchEntry> entries = [];

    public string Name => name;

    public void Add(IWatchEntry entry) => entries.Add(entry);

    public int Minutes() => entries.Sum(e => e.Minutes());

    public List<string> Titles() => entries.SelectMany(e => e.Titles()).ToList();
}
