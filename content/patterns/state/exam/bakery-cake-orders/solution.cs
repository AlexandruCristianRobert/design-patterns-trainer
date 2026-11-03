var order = new CakeOrder(30);
Console.WriteLine($"pay: {order.Pay()} [{order.Status}]");
Console.WriteLine($"bake: {order.Bake()} [{order.Status}]");
Console.WriteLine($"cancel: {order.Cancel()} [{order.Status}], refunded {order.Refunded}");

// What an order does with each request, in each stage. The stages hold nothing of their own.
public interface ICakeStage
{
    string Name { get; }
    string Pay(CakeOrder order);
    string Bake(CakeOrder order);
    string Collect(CakeOrder order);
    string Cancel(CakeOrder order);
}

// A birthday cake ordered at a bakery. It keeps the price, what was refunded, and the stage it is in.
// Every order shares the same five stage objects.
public class CakeOrder(int price)
{
    public static readonly ICakeStage Placed = new PlacedStage();
    public static readonly ICakeStage Paid = new PaidStage();
    public static readonly ICakeStage Baked = new BakedStage();
    public static readonly ICakeStage Collected = new CollectedStage();
    public static readonly ICakeStage Cancelled = new CancelledStage();

    private ICakeStage stage = Placed;

    public int Price { get; } = price;
    public int Refunded { get; private set; }
    public string Status => stage.Name;

    public void MoveTo(ICakeStage next) => stage = next;
    public void Refund(int euros) => Refunded = euros;

    public string Pay() => stage.Pay(this);
    public string Bake() => stage.Bake(this);
    public string Collect() => stage.Collect(this);
    public string Cancel() => stage.Cancel(this);
}

public class PlacedStage : ICakeStage
{
    public string Name => "placed";

    public string Pay(CakeOrder order)
    {
        order.MoveTo(CakeOrder.Paid);
        return $"paid {order.Price} euros";
    }

    public string Bake(CakeOrder order) => "pay first";
    public string Collect(CakeOrder order) => "not baked yet";

    public string Cancel(CakeOrder order)
    {
        order.MoveTo(CakeOrder.Cancelled);
        return "cancelled, nothing to refund";
    }
}

public class PaidStage : ICakeStage
{
    public string Name => "paid";

    public string Pay(CakeOrder order) => "already paid";

    public string Bake(CakeOrder order)
    {
        order.MoveTo(CakeOrder.Baked);
        return "baked";
    }

    public string Collect(CakeOrder order) => "not baked yet";

    public string Cancel(CakeOrder order)
    {
        order.Refund(order.Price);
        order.MoveTo(CakeOrder.Cancelled);
        return $"cancelled, {order.Price} euros refunded";
    }
}

public class BakedStage : ICakeStage
{
    public string Name => "baked";

    public string Pay(CakeOrder order) => "already paid";
    public string Bake(CakeOrder order) => "already baked";

    public string Collect(CakeOrder order)
    {
        order.MoveTo(CakeOrder.Collected);
        return "enjoy your cake";
    }

    // The cake is already made, so only half comes back.
    public string Cancel(CakeOrder order)
    {
        order.Refund(order.Price / 2);
        order.MoveTo(CakeOrder.Cancelled);
        return $"cancelled, {order.Price / 2} euros refunded";
    }
}

public class CollectedStage : ICakeStage
{
    public string Name => "collected";

    public string Pay(CakeOrder order) => "already paid";
    public string Bake(CakeOrder order) => "already baked";
    public string Collect(CakeOrder order) => "already collected";
    public string Cancel(CakeOrder order) => "already collected";
}

public class CancelledStage : ICakeStage
{
    public string Name => "cancelled";

    public string Pay(CakeOrder order) => "cancelled";
    public string Bake(CakeOrder order) => "cancelled";
    public string Collect(CakeOrder order) => "cancelled";
    public string Cancel(CakeOrder order) => "cancelled";
}
