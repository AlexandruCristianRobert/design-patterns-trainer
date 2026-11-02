foreach (var line in Demo.Run())
    Console.WriteLine(line);
Console.WriteLine($"Books downloaded: {Ebook.Downloads}");

public static class Demo
{
    public static List<string> Run()
    {
        var shelf = new Bookshelf();
        shelf.Add("Dune", bought: true);
        shelf.Add("Emma", bought: true);
        shelf.Add("Ulysses", bought: false);

        return
        [
            shelf.Titles(),
            shelf.Read("Dune", 1),
            shelf.Read("Dune", 2),
            shelf.Read("Ulysses", 1),
        ];
    }
}

// What the reading app knows about a book. Leave as is.
public interface IBook
{
    string Title { get; }
    string Read(int page);
}

// The real e-book. Creating one downloads the whole book, so the static Downloads count goes up by 1. Leave as is.
public class Ebook : IBook
{
    public static int Downloads { get; private set; }

    public Ebook(string title)
    {
        Title = title;
        Downloads++;
    }

    public string Title { get; }

    public string Read(int page) => $"{Title}, page {page}";
}

// The proxy: it knows the title and whether the book was bought,
// and downloads the real book the first time a bought book is read.
public class ShelfBook(string title, bool bought) : IBook
{
    private readonly Lazy<Ebook> book = new(() => new Ebook(title));

    public string Title => title;

    public string Read(int page) => bought ? book.Value.Read(page) : $"Buy {title} to read it";
}

// The shelf in the reading app. It holds proxies, so adding a book downloads nothing.
public class Bookshelf
{
    private readonly List<IBook> books = [];

    public void Add(string title, bool bought) => books.Add(new ShelfBook(title, bought));

    public string Titles() => string.Join(", ", books.Select(b => b.Title));

    public string Read(string title, int page) => books.First(b => b.Title == title).Read(page);
}
