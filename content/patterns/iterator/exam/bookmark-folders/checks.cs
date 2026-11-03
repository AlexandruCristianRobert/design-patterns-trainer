using System.Reflection;
using DesignPatterns.Checks;

static class BookmarkFolderChecks
{
    static Bookmark Mark(string title) => new(title, title.ToLowerInvariant() + ".example");

    // News, then Work (Mail, then Docs (Specs, Wiki), then Calendar), then Weather.
    static BookmarkFolder Bar()
    {
        var docs = new BookmarkFolder("Docs");
        docs.Add(Mark("Specs"));
        docs.Add(Mark("Wiki"));
        var work = new BookmarkFolder("Work");
        work.Add(Mark("Mail"));
        work.Add(docs);
        work.Add(Mark("Calendar"));
        var bar = new BookmarkFolder("Bookmarks bar");
        bar.Add(Mark("News"));
        bar.Add(work);
        bar.Add(Mark("Weather"));
        return bar;
    }

    // The titles a walk meets, such as "News, Mail", or "(none)".
    static string Titles(IEnumerable<Bookmark> walk)
    {
        var titles = new List<string>();
        foreach (var bookmark in walk)
        {
            titles.Add(bookmark.Title);
            if (titles.Count > 50) break;
        }
        return titles.Count == 0 ? "(none)" : string.Join(", ", titles);
    }

    static string Step(IEnumerator<Bookmark> walk) => walk.MoveNext() ? walk.Current.Title : "(none)";

    [Check("bookmarks-come-in-menu-order")]
    static void BookmarksComeInMenuOrder()
    {
        var all = Titles(Bar());
        const string expected = "News, Mail, Specs, Wiki, Calendar, Weather";
        Expect.That(all == expected, "wrongOrder", new { folder = "the bookmarks bar", expected, actual = all });

        var flat = new BookmarkFolder("Recipes");
        flat.Add(Mark("Soup"));
        flat.Add(Mark("Bread"));
        flat.Add(Mark("Cake"));
        var three = Titles(flat);
        Expect.That(three == "Soup, Bread, Cake", "wrongOrder", new { folder = "a folder of three bookmarks", expected = "Soup, Bread, Cake", actual = three });

        var inner = new BookmarkFolder("Work");
        inner.Add(Mark("Mail"));
        var only = Titles(inner);
        Expect.That(only == "Mail", "wrongOrder", new { folder = "a folder with one bookmark", expected = "Mail", actual = only });
    }

    [Check("deep-folders-are-walked-too")]
    static void DeepFoldersAreWalkedToo()
    {
        var bottom = new BookmarkFolder("Level 5");
        bottom.Add(Mark("Deep"));
        var folder = bottom;
        for (var level = 4; level >= 1; level--)
        {
            var outer = new BookmarkFolder($"Level {level}");
            outer.Add(folder);
            outer.Add(Mark($"After{level}"));
            folder = outer;
        }
        var met = Titles(folder);
        const string expected = "Deep, After4, After3, After2, After1";
        Expect.That(met == expected, "wrongDeep", new { expected, actual = met });
    }

    [Check("empty-folders-add-nothing")]
    static void EmptyFoldersAddNothing()
    {
        var none = Titles(new BookmarkFolder("New folder"));
        Expect.That(none == "(none)", "wrongEmpty", new { folder = "an empty folder", expected = "(none)", actual = none });

        var nested = new BookmarkFolder("Old");
        nested.Add(new BookmarkFolder("Older"));
        nested.Add(new BookmarkFolder("Oldest"));
        var stillNone = Titles(nested);
        Expect.That(stillNone == "(none)", "wrongEmpty", new { folder = "a folder of two empty folders", expected = "(none)", actual = stillNone });

        var mixed = new BookmarkFolder("Mixed");
        mixed.Add(new BookmarkFolder("Empty"));
        mixed.Add(Mark("Maps"));
        mixed.Add(new BookmarkFolder("Also empty"));
        mixed.Add(Mark("Music"));
        var two = Titles(mixed);
        Expect.That(two == "Maps, Music", "wrongEmpty", new { folder = "empty folders between Maps and Music", expected = "Maps, Music", actual = two });
    }

    [Check("a-folder-filled-later-is-walked-as-it-is-now")]
    static void AFolderFilledLaterIsWalkedAsItIsNow()
    {
        var bar = new BookmarkFolder("Bookmarks bar");
        var trips = new BookmarkFolder("Trips");
        bar.Add(trips);
        bar.Add(Mark("Bank"));
        trips.Add(Mark("Trains"));
        trips.Add(Mark("Hotels"));
        var met = Titles(bar);
        Expect.That(met == "Trains, Hotels, Bank", "filledLaterMissed", new { expected = "Trains, Hotels, Bank", actual = met });
    }

    [Check("two-walks-keep-their-own-place")]
    static void TwoWalksKeepTheirOwnPlace()
    {
        var bar = Bar();
        var first = bar.GetEnumerator();
        var second = bar.GetEnumerator();
        Step(first);
        Step(first);
        var a = Step(first);
        var b = Step(second);
        var places = $"{a} / {b}";
        Expect.That(places == "Specs / News", "sharedPlace", new { expected = "Specs / News", actual = places });

        while (second.MoveNext()) { }
        var next = Step(first);
        Expect.That(next == "Wiki", "disturbedByOther", new { expected = "Wiki", actual = next });
    }

    [Check("search-finds-the-first-match-in-menu-order")]
    static void SearchFindsTheFirstMatchInMenuOrder()
    {
        var bar = Bar();
        bar.Add(Mark("Calendly"));
        var cal = BookmarkSearch.Find(bar, "CAL");
        Expect.That(cal == "Calendar", "wrongFind", new { word = "CAL", expected = "Calendar", actual = cal });

        var wiki = BookmarkSearch.Find(bar, "ik");
        Expect.That(wiki == "Wiki", "wrongFind", new { word = "ik", expected = "Wiki", actual = wiki });

        var none = BookmarkSearch.Find(bar, "zoo");
        Expect.That(none == "nothing found", "wrongFind", new { word = "zoo", expected = "nothing found", actual = none });
    }

    [Check("a-folder-keeps-its-entries-to-itself")]
    static void AFolderKeepsItsEntriesToItself()
    {
        var shown = StorageShown(typeof(BookmarkFolder));
        Expect.That(shown is null, "storageShown", new { member = shown });
    }

    // The first public member of the type that hands out an array or a collection: a field, a property or a method; null when there is none.
    static string? StorageShown(Type type)
    {
        const BindingFlags Public = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static;
        var field = type.GetFields(Public).FirstOrDefault(f => IsStorage(f.FieldType));
        if (field is not null) return field.Name;
        var property = type.GetProperties(Public).FirstOrDefault(p => IsStorage(p.PropertyType));
        if (property is not null) return property.Name;
        return type.GetMethods(Public).FirstOrDefault(m => !m.IsSpecialName && IsStorage(m.ReturnType))?.Name;
    }

    // An array, or a type that can be counted and changed like a list: anything beyond a walk.
    static bool IsStorage(Type type) =>
        type.IsArray
        || typeof(System.Collections.ICollection).IsAssignableFrom(type)
        || type.GetInterfaces().Append(type).Any(i => i.IsGenericType
            && (i.GetGenericTypeDefinition() == typeof(ICollection<>) || i.GetGenericTypeDefinition() == typeof(IReadOnlyCollection<>)));
}
