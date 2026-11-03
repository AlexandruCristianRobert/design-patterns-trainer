using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BookshelfChecks
{
    // All Checks share one load of the program, so Ebook.Downloads may already be above 0 when a Check starts.
    // Each Check therefore counts only the downloads made while it runs.

    // A new ShelfBook, made through its public constructor that takes a title and whether the book was bought.
    static IBook NewShelfBook(string title, bool bought)
    {
        var type = Code.Type("ShelfBook").Clr;
        var constructor = type.GetConstructor([typeof(string), typeof(bool)]);
        if (constructor is null) Expect.Fail("noShelfBookConstructor");
        if (constructor.Invoke([title, bought]) is not IBook book)
        {
            Expect.Fail("shelfBookNotABook");
            return null!;
        }
        return book;
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["Dune, Emma, Ulysses", "Dune, page 1", "Dune, page 2", "Buy Ulysses to read it"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("adding-downloads-nothing")]
    static void AddingDownloadsNothing()
    {
        var before = Ebook.Downloads;
        var shelf = new Bookshelf();
        shelf.Add("Dune", true);
        shelf.Add("Emma", true);
        shelf.Add("Ulysses", false);
        var titles = shelf.Titles();
        var downloads = Ebook.Downloads - before;

        Expect.That(titles == "Dune, Emma, Ulysses", "wrongTitles", new { expected = "Dune, Emma, Ulysses", actual = titles });
        Expect.That(downloads == 0, "downloadedOnAdd", new { downloads });
    }

    [Check("first-read-downloads-once")]
    static void FirstReadDownloadsOnce()
    {
        var before = Ebook.Downloads;
        var book = NewShelfBook("Emma", true);
        var title = book.Title;
        var early = Ebook.Downloads - before;
        Expect.That(title == "Emma", "wrongTitle", new { expected = "Emma", actual = title });
        Expect.That(early == 0, "downloadedEarly", new { downloads = early });

        book.Read(1);
        book.Read(2);
        book.Read(7);
        var downloads = Ebook.Downloads - before;
        Expect.That(downloads >= 1, "notDownloadedOnRead");
        Expect.That(downloads == 1, "downloadedMoreThanOnce", new { downloads });

        var shelfBefore = Ebook.Downloads;
        var shelf = new Bookshelf();
        shelf.Add("Dune", true);
        shelf.Add("Emma", true);
        shelf.Read("Dune", 1);
        shelf.Read("Dune", 2);
        var shelfDownloads = Ebook.Downloads - shelfBefore;
        Expect.That(shelfDownloads == 1, "shelfDownloadsWrong", new { downloads = shelfDownloads });
    }

    [Check("unbought-book-stays-closed")]
    static void UnboughtBookStaysClosed()
    {
        var before = Ebook.Downloads;
        var page = NewShelfBook("Ulysses", false).Read(1);
        var shelf = new Bookshelf();
        shelf.Add("Ulysses", false);
        var shelfPage = shelf.Read("Ulysses", 5);
        var downloads = Ebook.Downloads - before;

        Expect.That(page == "Buy Ulysses to read it" && shelfPage == "Buy Ulysses to read it", "wrongRefusal", new { page, shelfPage });
        Expect.That(downloads == 0, "downloadedUnbought", new { downloads });
    }

    [Check("pages-come-from-the-book")]
    static void PagesComeFromTheBook()
    {
        var page = NewShelfBook("Dune", true).Read(3);
        var real = new Ebook("Dune").Read(3);

        Expect.That(page == real, "differentPage", new { page, real });
    }

    [Check("shelf-holds-shelf-books")]
    static void ShelfHoldsShelfBooks()
    {
        var type = Code.Type("ShelfBook").Clr;
        Expect.That(typeof(IBook).IsAssignableFrom(type), "shelfBookNotABook");
        Expect.That(!typeof(Ebook).IsAssignableFrom(type), "shelfBookIsEbook");

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "Bookshelf"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Any(n => n.Identifier.ValueText == "Ebook");
            Expect.That(!named, "shelfNamesEbook");
        }
    }
}
