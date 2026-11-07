using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PlaylistChecks
{
    // An order the Playlist has never seen: it returns the songs in reverse.
    sealed class Reverse : ISongOrder
    {
        public IEnumerable<Song> Arrange(IReadOnlyList<Song> songs) => songs.Reverse();
    }

    static List<Song> Songs() =>
        [new("Night Drive", 245), new("Arrival", 180), new("Comet", 312), new("Blue Hour", 200)];

    static string Titles(IEnumerable<Song> songs) => songs.Any() ? string.Join(", ", songs.Select(s => s.Title)) : "nothing";

    [Check("playlist-uses-its-order")]
    static void PlaylistUsesItsOrder()
    {
        var result = Titles(new Playlist(Songs(), new Reverse()).Ordered());

        Expect.That(result == "Blue Hour, Comet, Arrival, Night Drive", "orderIgnored",
            new { expected = "Blue Hour, Comet, Arrival, Night Drive", actual = result });
    }

    [Check("by-length-shortest-first")]
    static void ByLengthShortestFirst()
    {
        var result = Titles(new Playlist(Songs(), new ByLength()).Ordered());

        Expect.That(result == "Arrival, Blue Hour, Night Drive, Comet", "wrongLengthOrder",
            new { expected = "Arrival, Blue Hour, Night Drive, Comet", actual = result });
    }

    [Check("order-can-change")]
    static void OrderCanChange()
    {
        var playlist = new Playlist(Songs(), new ByTitle());
        var byTitle = Titles(playlist.Ordered());

        playlist.Order = new AsAdded();
        var asAdded = Titles(playlist.Ordered());

        Expect.That(byTitle == "Arrival, Blue Hour, Comet, Night Drive", "wrongTitleOrder", new { expected = "Arrival, Blue Hour, Comet, Night Drive", actual = byTitle });
        Expect.That(asAdded == "Night Drive, Arrival, Comet, Blue Hour", "addedOrderLost", new { expected = "Night Drive, Arrival, Comet, Blue Hour", actual = asAdded });
    }

    [Check("playlist-knows-only-the-interface")]
    static void PlaylistKnowsOnlyTheInterface()
    {
        var concrete = typeof(ISongOrder).Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(ISongOrder).IsAssignableFrom(t) && t.DeclaringType != typeof(PlaylistChecks))
            .Select(t => t.Name).ToHashSet();

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "Playlist"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "playlistNamesOrder", new { type = named });

            var branches = declaration.DescendantNodes().Any(n =>
                n is IfStatementSyntax or SwitchStatementSyntax or SwitchExpressionSyntax or ConditionalExpressionSyntax
                    or IsPatternExpressionSyntax ||
                n is BinaryExpressionSyntax b && b.OperatorToken.ValueText == "is");
            Expect.That(!branches, "playlistBranches");
        }
    }
}
