var playlist = new Playlist(
    [new Song("Night Drive", 245), new Song("Arrival", 180), new Song("Comet", 312), new Song("Blue Hour", 180)],
    new ByTitle());
Print("By title", playlist);

playlist.Order = new ByLength();
Print("By length", playlist);

playlist.Order = new AsAdded();
Print("As added", playlist);

static void Print(string heading, Playlist playlist)
{
    Console.WriteLine(heading);
    foreach (var song in playlist.Ordered())
        Console.WriteLine($"  {song.Title} ({song.Seconds / 60}:{song.Seconds % 60:00})");
}

public record Song(string Title, int Seconds);

public interface ISongOrder
{
    IEnumerable<Song> Arrange(IReadOnlyList<Song> songs);
}

public class Playlist(IEnumerable<Song> songs, ISongOrder order)
{
    private readonly List<Song> _songs = [.. songs];

    public ISongOrder Order { get; set; } = order;

    public List<Song> Ordered() => [.. Order.Arrange(_songs.AsReadOnly())];
}

public class AsAdded : ISongOrder
{
    public IEnumerable<Song> Arrange(IReadOnlyList<Song> songs) => songs;
}

public class ByTitle : ISongOrder
{
    public IEnumerable<Song> Arrange(IReadOnlyList<Song> songs) => songs.OrderBy(s => s.Title, StringComparer.Ordinal);
}

public class ByLength : ISongOrder
{
    // OrderBy is stable, so songs of equal length keep the order they were added in.
    public IEnumerable<Song> Arrange(IReadOnlyList<Song> songs) => songs.OrderBy(s => s.Seconds);
}
