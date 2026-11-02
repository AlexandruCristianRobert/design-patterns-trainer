using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class WatchlistChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Three levels: all holds Up and classics; classics holds Metropolis and noir; noir holds Laura and The Third Man.
    static (Folder All, Folder Noir) ThreeLevels()
    {
        var noir = new Folder("Noir");
        noir.Add(new Film("Laura", 88));
        noir.Add(new Film("The Third Man", 104));
        var classics = new Folder("Classics");
        classics.Add(new Film("Metropolis", 153));
        classics.Add(noir);
        var all = new Folder("All");
        all.Add(new Film("Up", 96));
        all.Add(classics);
        return (all, noir);
    }

    static string Show(List<string> titles) => titles.Count == 0 ? "nothing" : string.Join(", ", titles);

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("film-answers-for-itself")]
    static void FilmAnswersForItself()
    {
        IWatchEntry film = new Film("Amélie", 122);

        Expect.That(film.Minutes() == 122, "wrongMinutes", new { actual = film.Minutes() });
        Expect.That(Show(film.Titles()) == "Amélie", "wrongTitles", new { actual = Show(film.Titles()) });
    }

    [Check("folder-adds-up-minutes")]
    static void FolderAddsUpMinutes()
    {
        var (all, noir) = ThreeLevels();
        var before = ((IWatchEntry)all).Minutes();
        noir.Add(new Film("Gilda", 110));
        var after = ((IWatchEntry)all).Minutes();

        Expect.That(before == 441, "wrongMinutes", new { actual = before });
        Expect.That(after == 551, "missedLateFilm", new { actual = after });
    }

    [Check("folder-lists-titles-in-order")]
    static void FolderListsTitlesInOrder()
    {
        var (all, _) = ThreeLevels();
        var titles = Show(((IWatchEntry)all).Titles());

        Expect.That(titles == "Up, Metropolis, Laura, The Third Man", "wrongTitles", new { actual = titles });
    }

    [Check("empty-folder-works")]
    static void EmptyFolderWorks()
    {
        IWatchEntry empty = new Folder("Someday");
        var minutes = empty.Minutes();
        var titles = Show(empty.Titles());
        var (all, _) = ThreeLevels();
        all.Add(new Folder("Someday"));
        var withEmpty = ((IWatchEntry)all).Minutes();
        var withEmptyTitles = Show(((IWatchEntry)all).Titles());

        Expect.That(minutes == 0 && titles == "nothing", "emptyNotEmpty", new { minutes, titles });
        Expect.That(withEmpty == 441 && withEmptyTitles == "Up, Metropolis, Laura, The Third Man", "emptyChangedTotals",
            new { minutes = withEmpty, titles = withEmptyTitles });
    }

    [Check("films-and-folders-share-one-type")]
    static void FilmsAndFoldersShareOneType()
    {
        Expect.That(typeof(IWatchEntry).IsAssignableFrom(typeof(Film)), "filmNotAnEntry");
        Expect.That(typeof(IWatchEntry).IsAssignableFrom(typeof(Folder)), "folderNotAnEntry");

        var fields = typeof(Folder).GetFields(Declared);
        Expect.That(fields.Any(f => Inside(f.FieldType).Contains(typeof(IWatchEntry))), "noEntryField");
        Expect.That(!fields.SelectMany(f => Inside(f.FieldType)).Contains(typeof(Film)), "folderHoldsFilms");

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "Folder"))
        {
            var mentions = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Any(n => n.Identifier.ValueText == "Film");
            Expect.That(!mentions, "folderNamesFilm");
        }
    }
}
