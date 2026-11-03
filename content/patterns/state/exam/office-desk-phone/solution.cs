var phone = new DeskPhone();
Console.WriteLine($"ring: {phone.Ring()}");
Console.WriteLine($"pick up: {phone.PickUp()}");
Console.WriteLine($"hold: {phone.Hold()}");
Console.WriteLine($"ring: {phone.Ring()}");
Console.WriteLine($"hold: {phone.Hold()}");
Console.WriteLine($"put down: {phone.PutDown()} [{phone.Status}, answered {phone.Answered}]");

// What the phone does with each button. It gives the answers most stages share; each stage overrides the rest.
public class PhoneStage
{
    public virtual string Name => "idle";
    public virtual string Ring(DeskPhone phone) => "call waiting";
    public virtual string PickUp(DeskPhone phone) => "already talking";
    public virtual string Hold(DeskPhone phone) => "no call";
    public virtual string PutDown(DeskPhone phone)
    {
        phone.MoveTo(new Idle());
        return "call ended";
    }
}

// A phone on an office desk. It counts the calls answered and holds the stage it is in.
public class DeskPhone
{
    private PhoneStage stage = new Idle();

    public string Status => stage.Name;
    public int Answered { get; private set; }

    public void MoveTo(PhoneStage next) => stage = next;
    public void CountAnswered() => Answered++;

    public string Ring() => stage.Ring(this);
    public string PickUp() => stage.PickUp(this);
    public string Hold() => stage.Hold(this);
    public string PutDown() => stage.PutDown(this);
}

public class Idle : PhoneStage
{
    public override string Name => "idle";

    public override string Ring(DeskPhone phone)
    {
        phone.MoveTo(new Ringing());
        return "ringing";
    }

    public override string PickUp(DeskPhone phone) => "dial tone";
    public override string PutDown(DeskPhone phone) => "already down";
}

public class Ringing : PhoneStage
{
    public override string Name => "ringing";

    public override string Ring(DeskPhone phone) => "already ringing";

    public override string PickUp(DeskPhone phone)
    {
        phone.CountAnswered();
        phone.MoveTo(new Talking());
        return "connected";
    }

    public override string Hold(DeskPhone phone) => "pick up first";

    public override string PutDown(DeskPhone phone)
    {
        phone.MoveTo(new Idle());
        return "call rejected";
    }
}

public class Talking : PhoneStage
{
    public override string Name => "talking";

    public override string Hold(DeskPhone phone)
    {
        phone.MoveTo(new OnHold());
        return "on hold";
    }
}

public class OnHold : PhoneStage
{
    public override string Name => "on hold";

    public override string PickUp(DeskPhone phone) => BackToTheCall(phone);
    public override string Hold(DeskPhone phone) => BackToTheCall(phone);

    private static string BackToTheCall(DeskPhone phone)
    {
        phone.MoveTo(new Talking());
        return "back to the call";
    }
}
