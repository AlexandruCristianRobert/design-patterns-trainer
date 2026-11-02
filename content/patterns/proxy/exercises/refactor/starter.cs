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

// The shelf in the reading app. It downloads every book as soon as it is added,
// and it keeps its own list of the books that were bought.
public class Bookshelf
{
    private readonly List<IBook> books = [];
    private readonly HashSet<string> bought = [];

    public void Add(string title, bool bought)
    {
        books.Add(new Ebook(title));
        if (bought)
            this.bought.Add(title);
    }

    public string Titles() => string.Join(", ", books.Select(b => b.Title));

    public string Read(string title, int page)
    {
        if (!bought.Contains(title))
            return $"Buy {title} to read it";
        return books.First(b => b.Title == title).Read(page);
    }
}
