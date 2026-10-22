var auction = new Auction();
var anna = new ConsoleBidder("Anna");
var ben = new ConsoleBidder("Ben");
auction.Follow(anna);
auction.Follow(ben);

auction.PlaceBid("Anna", 100m);
auction.PlaceBid("Ben", 90m);
auction.PlaceBid("Ben", 120m);

auction.Unfollow(anna);
auction.PlaceBid("Carl", 150m);

public interface IBidder
{
    string Name { get; }
    void OnNewHighBid(string bidder, decimal amount);
}

public class Auction
{
    private readonly List<IBidder> _followers = [];
    private decimal _highest;

    public void Follow(IBidder bidder) => _followers.Add(bidder);

    public void Unfollow(IBidder bidder) => _followers.Remove(bidder);

    public void PlaceBid(string bidder, decimal amount)
    {
        if (amount <= _highest) return;
        _highest = amount;
        foreach (var follower in _followers.ToList())
            if (follower.Name != bidder)
                follower.OnNewHighBid(bidder, amount);
    }
}

public class ConsoleBidder(string name) : IBidder
{
    public string Name => name;

    public void OnNewHighBid(string bidder, decimal amount) =>
        Console.WriteLine($"{name} hears: {bidder} now leads with {amount}");
}
