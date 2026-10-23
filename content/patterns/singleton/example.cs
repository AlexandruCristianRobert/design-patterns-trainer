var counter = new ShopCounter();
var online = new OnlineOrders();
Console.WriteLine($"Dispensers so far: {TicketDispenser.Created}");

Console.WriteLine(counter.Serve("Ana"));
Console.WriteLine(online.Serve("Ben"));

Console.WriteLine($"Dispensers so far: {TicketDispenser.Created}");
Console.WriteLine($"Same object: {ReferenceEquals(TicketDispenser.Instance, TicketDispenser.Instance)}");

public sealed class TicketDispenser
{
    // Lazy<T> runs the factory once, on first use, and is thread-safe by default.
    private static readonly Lazy<TicketDispenser> instance = new(() => new TicketDispenser());

    public static TicketDispenser Instance => instance.Value;

    // Counts constructor runs, to show there is only ever one.
    public static int Created { get; private set; }

    private int last;

    // Private, so no other class can write new TicketDispenser().
    private TicketDispenser() => Created++;

    public int Next() => ++last;
}

public class ShopCounter
{
    public string Serve(string customer) => $"Counter: {customer} gets ticket {TicketDispenser.Instance.Next()}";
}

public class OnlineOrders
{
    public string Serve(string customer) => $"Online: {customer} gets ticket {TicketDispenser.Instance.Next()}";
}
