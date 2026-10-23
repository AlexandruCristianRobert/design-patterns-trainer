using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PlaylistChecks
{
    // Records the songs it was handed and returns them in reverse.
    sealed class Reverse : ISongOrder
    {
        public List<string> Received { get; } = [];

        public IEnumerable<Song> Arrange(IReadOnlyList<Song> songs)
        {
            Received.AddRange(songs.Select(s => s.Title));
            return songs.Reverse();
        }
    }

    static List<Song> Songs() =>
        [new("Night Drive", 245), new("Arrival", 180), new("Comet", 312), new("Blue Hour", 180)];

    static string Titles(IEnumerable<Song> songs) => string.Join(", ", songs.Select(s => s.Title));

    static string Titles(IEnumerable<string> titles) => titles.Any() ? string.Join(", ", titles) : "nothing";

    [Check("playlist-uses-its-order")]
    static void PlaylistUsesItsOrder()
    {
        var order = new Reverse();
        var playlist = new Playlist(Songs(), order);

        var result = playlist.Ordered();

        Expect.That(order.Received.SequenceEqual(["Night Drive", "Arrival", "Comet", "Blue Hour"]), "notHandedSongs",
            new { actual = Titles(order.Received) });
        Expect.That(Titles(result) == "Blue Hour, Comet, Arrival, Night Drive", "orderIgnored", new { actual = Titles(result) });
    }

    [Check("by-length-shortest-first")]
    static void ByLengthShortestFirst()
    {
        var result = new Playlist(Songs(), new ByLength()).Ordered();

        Expect.That(Titles(result) == "Arrival, Blue Hour, Night Drive, Comet", "wrongLengthOrder", new { actual = Titles(result) });
    }

    [Check("order-can-change")]
    static void OrderCanChange()
    {
        var playlist = new Playlist(Songs(), new ByTitle());
        var byTitle = Titles(playlist.Ordered());

        playlist.Order = new AsAdded();
        var asAdded = Titles(playlist.Ordered());

        Expect.That(byTitle == "Arrival, Blue Hour, Comet, Night Drive", "wrongTitleOrder", new { actual = byTitle });
        Expect.That(asAdded == "Night Drive, Arrival, Comet, Blue Hour", "addedOrderLost", new { actual = asAdded });
    }

    [Check("playlist-knows-only-the-interface")]
    static void PlaylistKnowsOnlyTheInterface()
    {
        var concrete = typeof(ISongOrder).Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(ISongOrder).IsAssignableFrom(t) && t.DeclaringType != typeof(PlaylistChecks))
            .Select(t => t.Name).Append("GetType").ToHashSet();

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "Playlist"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "playlistNamesOrder", new { type = named });
        }
    }
}
