var phone = new Phone();
phone.Drain(85);
Console.WriteLine($"{phone.Battery}%: {phone.Mode}, sync {phone.Sync()}, {phone.Camera()}");
phone.Charge(20);
Console.WriteLine($"{phone.Battery}%: {phone.Mode}, sync {phone.Sync()}, {phone.Camera()}");
phone.Charge(20);
Console.WriteLine($"{phone.Battery}%: {phone.Mode}, sync {phone.Sync()}, {phone.Camera()}");

// What the phone does in a power mode, and which mode comes after the battery changes.
// The modes hold nothing of their own, so every phone shares one instance of each.
public abstract class PowerMode
{
    public abstract string Name { get; }
    public abstract string Sync();
    public abstract string Camera();
    public virtual void AfterDrain(Phone phone) { }
    public virtual void AfterCharge(Phone phone) { }
}

// A phone that saves its battery by itself: it changes how it works as the battery runs down or charges up.
public class Phone
{
    private PowerMode mode = Normal.Instance;

    public int Battery { get; private set; } = 100;

    public string Mode => mode.Name;

    public void Use(PowerMode next) => mode = next;

    public void Drain(int percent)
    {
        Battery = Math.Max(0, Battery - percent);
        mode.AfterDrain(this);
    }

    public void Charge(int percent)
    {
        Battery = Math.Min(100, Battery + percent);
        mode.AfterCharge(this);
    }

    public string Sync() => mode.Sync();
    public string Camera() => mode.Camera();
}

public sealed class Normal : PowerMode
{
    public static readonly Normal Instance = new();

    public override string Name => "normal";
    public override string Sync() => "every 15 minutes";
    public override string Camera() => "camera on";

    public override void AfterDrain(Phone phone)
    {
        if (phone.Battery <= 5) phone.Use(Critical.Instance);
        else if (phone.Battery <= 20) phone.Use(Saver.Instance);
    }
}

public sealed class Saver : PowerMode
{
    public static readonly Saver Instance = new();

    public override string Name => "saver";
    public override string Sync() => "every hour";
    public override string Camera() => "camera on, flash off";

    public override void AfterDrain(Phone phone)
    {
        if (phone.Battery <= 5) phone.Use(Critical.Instance);
    }

    // Only a well charged battery ends saving, so the phone does not flip back and forth around 20%.
    public override void AfterCharge(Phone phone)
    {
        if (phone.Battery >= 50) phone.Use(Normal.Instance);
    }
}

public sealed class Critical : PowerMode
{
    public static readonly Critical Instance = new();

    public override string Name => "critical";
    public override string Sync() => "off";
    public override string Camera() => "battery too low";

    public override void AfterCharge(Phone phone)
    {
        if (phone.Battery >= 50) phone.Use(Normal.Instance);
        else if (phone.Battery > 5) phone.Use(Saver.Instance);
    }
}
