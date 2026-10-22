using DesignPatterns.Checks;

static class AuctionChecks
{
    sealed class Recorder(string name) : IBidder
    {
        public string Name => name;
        public List<(string Bidder, decimal Amount)> Heard { get; } = [];
        public void OnNewHighBid(string bidder, decimal amount) => Heard.Add((bidder, amount));
    }

    [Check("followers-told-of-higher-bid")]
    static void FollowersToldOfHigherBid()
    {
        var auction = new Auction();
        var anna = new Recorder("Anna");
        var ben = new Recorder("Ben");
        auction.Follow(anna);
        auction.Follow(ben);

        auction.PlaceBid("Carl", 100m);
        auction.PlaceBid("Dora", 150m);

        foreach (var follower in new[] { anna, ben })
        {
            Expect.That(follower.Heard.Count == 2, "wrongCount", new { follower = follower.Name, count = follower.Heard.Count });
            Expect.That(follower.Heard[0] == ("Carl", 100m) && follower.Heard[1] == ("Dora", 150m), "wrongNews",
                new { follower = follower.Name });
        }
    }

    [Check("lower-bid-ignored")]
    static void LowerBidIgnored()
    {
        var auction = new Auction();
        var anna = new Recorder("Anna");
        auction.Follow(anna);

        auction.PlaceBid("Carl", 100m);
        auction.PlaceBid("Dora", 90m);
        auction.PlaceBid("Ed", 100m);
        auction.PlaceBid("Fay", 101m);

        foreach (var (bidder, amount) in anna.Heard)
            Expect.That(bidder is "Carl" or "Fay", "toldLowerBid", new { bidder, amount });
        Expect.That(anna.Heard.SequenceEqual([("Carl", 100m), ("Fay", 101m)]), "higherBidMissed");
    }

    [Check("unfollowed-not-told")]
    static void UnfollowedNotTold()
    {
        var auction = new Auction();
        var anna = new Recorder("Anna");
        var ben = new Recorder("Ben");
        auction.Follow(anna);
        auction.Follow(ben);
        auction.PlaceBid("Carl", 100m);

        auction.Unfollow(anna);
        auction.PlaceBid("Dora", 120m);

        Expect.That(anna.Heard.All(h => h.Bidder != "Dora"), "toldAfterUnfollow");
        Expect.That(ben.Heard.Any(h => h.Bidder == "Dora"), "stillFollowingMissed");
    }

    [Check("bidder-not-told-own-bid")]
    static void BidderNotToldOwnBid()
    {
        var auction = new Auction();
        var anna = new Recorder("Anna");
        var ben = new Recorder("Ben");
        auction.Follow(anna);
        auction.Follow(ben);

        auction.PlaceBid("Anna", 100m);

        Expect.That(anna.Heard.Count == 0, "toldOwnBid");
        Expect.That(ben.Heard.SequenceEqual([("Anna", 100m)]), "othersNotTold");
    }
}
