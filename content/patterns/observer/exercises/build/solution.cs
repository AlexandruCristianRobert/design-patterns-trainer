var auction = new Auction();
var anna = new ConsoleBidder("Anna");
var ben = new ConsoleBidder("Ben");
auction.Follow(anna);
auction.Follow(ben);

auction.PlaceBid("Carl", 100);
auction.PlaceBid("Dora", 120);

auction.Unfollow(anna);
auction.PlaceBid("Carl", 150);

public interface IBidder
{
    void OnNewBid(string bidder, int amount);
}

public class Auction
{
    private readonly List<IBidder> _followers = [];

    public void Follow(IBidder bidder) => _followers.Add(bidder);

    public void Unfollow(IBidder bidder) => _followers.Remove(bidder);

    public void PlaceBid(string bidder, int amount)
    {
        foreach (var follower in _followers.ToList())
            follower.OnNewBid(bidder, amount);
    }
}

public class ConsoleBidder(string name) : IBidder
{
    public void OnNewBid(string bidder, int amount) =>
        Console.WriteLine($"{name} hears: {bidder} bid {amount}");
}
