// Every edit is an object. The history runs it, keeps it, and can ask it to undo itself.
var playlist = new Playlist();
var history = new EditHistory();

void Show(string what) => Console.WriteLine($"{what}: {playlist}");

history.Run(new AddSong(playlist, "Blue Monday"));
Show("add Blue Monday");
history.Run(new AddSong(playlist, "Heroes"));
Show("add Heroes");
history.Run(new AddSong(playlist, "Starman"));
Show("add Starman");
history.Run(new MoveSong(playlist, 2, 0));
Show("move Starman to the top");
history.Run(new RemoveSong(playlist, 1));
Show("remove song 2");
history.Undo();
Show("undo");
history.Undo();
Show("undo");

public interface IPlaylistEdit
{
    void Do();
    void Undo();
}

public class AddSong(Playlist playlist, string title) : IPlaylistEdit
{
    public void Do() => playlist.Insert(playlist.Count, title);
    public void Undo() => playlist.RemoveAt(playlist.Count - 1);
}

public class RemoveSong(Playlist playlist, int index) : IPlaylistEdit
{
    private string removed = "";

    public void Do() => removed = playlist.RemoveAt(index);
    public void Undo() => playlist.Insert(index, removed);
}

public class MoveSong(Playlist playlist, int from, int to) : IPlaylistEdit
{
    public void Do() => playlist.Move(from, to);
    public void Undo() => playlist.Move(to, from);
}

public class Playlist
{
    private readonly List<string> songs = [];

    public int Count => songs.Count;

    public void Insert(int index, string title) => songs.Insert(index, title);

    public string RemoveAt(int index)
    {
        var title = songs[index];
        songs.RemoveAt(index);
        return title;
    }

    public void Move(int from, int to) => Insert(to, RemoveAt(from));

    public override string ToString() => string.Join(", ", songs);
}

public class EditHistory
{
    private readonly Stack<IPlaylistEdit> done = new();

    public void Run(IPlaylistEdit edit)
    {
        edit.Do();
        done.Push(edit);
    }

    public void Undo()
    {
        if (done.Count > 0)
            done.Pop().Undo();
    }
}
