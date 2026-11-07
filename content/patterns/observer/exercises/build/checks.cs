using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class AuctionChecks
{
    sealed class Recorder : IBidder
    {
        public List<(string Bidder, int Amount)> Heard { get; } = [];
        public void OnNewBid(string bidder, int amount) => Heard.Add((bidder, amount));
    }

    static string Show(Recorder r) =>
        r.Heard.Count == 0 ? "nothing" : string.Join(", ", r.Heard.Select(h => $"{h.Bidder} {h.Amount}"));

    [Check("followers-told-of-each-bid")]
    static void FollowersToldOfEachBid()
    {
        var auction = new Auction();
        var anna = new Recorder();
        var ben = new Recorder();
        auction.Follow(anna);
        auction.Follow(ben);

        auction.PlaceBid("Carl", 100);
        auction.PlaceBid("Dora", 150);

        foreach (var follower in new[] { anna, ben })
            Expect.That(Show(follower) == "Carl 100, Dora 150", "wrongNews",
                new { expected = "Carl 100, Dora 150", actual = Show(follower) });
    }

    [Check("unfollowed-not-told")]
    static void UnfollowedNotTold()
    {
        var auction = new Auction();
        var anna = new Recorder();
        var ben = new Recorder();
        auction.Follow(anna);
        auction.Follow(ben);
        var otherAuction = new Auction();
        var carl = new Recorder();
        otherAuction.Follow(carl);

        auction.Unfollow(anna);
        auction.PlaceBid("Dora", 120);

        Expect.That(anna.Heard.Count == 0, "toldAfterUnfollow");
        Expect.That(carl.Heard.Count == 0, "toldOtherAuction");
        Expect.That(Show(ben) == "Dora 120", "stillFollowingMissed", new { expected = "Dora 120", actual = Show(ben) });
    }

    [Check("auction-knows-only-the-interface")]
    static void AuctionKnowsOnlyTheInterface()
    {
        var concrete = typeof(IBidder).Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(IBidder).IsAssignableFrom(t) && t.DeclaringType != typeof(AuctionChecks))
            .Select(t => t.Name).ToHashSet();

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "Auction"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "auctionNamesBidder", new { type = named });
        }
    }
}
