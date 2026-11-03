using System.Collections;

var bar = new BookmarkFolder("Bookmarks bar");
var work = new BookmarkFolder("Work");
var docs = new BookmarkFolder("Docs");
bar.Add(new Bookmark("News", "news.example"));
bar.Add(work);
work.Add(new Bookmark("Mail", "mail.example"));
work.Add(docs);
docs.Add(new Bookmark("Specs", "specs.example"));
work.Add(new Bookmark("Calendar", "calendar.example"));
bar.Add(new Bookmark("Weather", "weather.example"));

foreach (var bookmark in bar)
    Console.WriteLine($"{bookmark.Title} ({bookmark.Address})");
Console.WriteLine(BookmarkSearch.Find(bar, "cal"));

public record Bookmark(string Title, string Address);

// A folder of bookmarks and other folders, in the order they were added. It keeps its entries to itself.
public class BookmarkFolder(string name) : IEnumerable<Bookmark>
{
    private readonly List<object> entries = [];

    public string Name => name;

    public void Add(Bookmark bookmark) => entries.Add(bookmark);
    public void Add(BookmarkFolder folder) => entries.Add(folder);

    // Every bookmark in menu order: a folder's bookmarks come where the folder is, however deep they are.
    public IEnumerator<Bookmark> GetEnumerator()
    {
        foreach (var entry in entries)
        {
            if (entry is Bookmark bookmark)
                yield return bookmark;
            else
                foreach (var inner in (BookmarkFolder)entry)
                    yield return inner;
        }
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

public static class BookmarkSearch
{
    public static string Find(BookmarkFolder folder, string word) =>
        folder.FirstOrDefault(b => b.Title.Contains(word, StringComparison.OrdinalIgnoreCase))?.Title ?? "nothing found";
}
