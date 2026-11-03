// The buttons know only the call screen. A button says "I changed", and the screen decides who reacts.
var call = new CallScreen();
call.Share.Press();
Console.WriteLine(call.Status.Text);
call.Camera.Press();
Console.WriteLine(call.Status.Text);
call.Hand.Press();
Console.WriteLine(call.Status.Text);
call.Mic.Press();
Console.WriteLine(call.Status.Text);

// What every button talks to. A button calls Changed with itself after it changes. Leave as is.
public interface ICallScreen
{
    void Changed(object button);
}

// Mutes and unmutes the microphone. Leave as is.
public class MicButton(ICallScreen screen)
{
    public bool IsOn { get; private set; }

    public void Press()
    {
        IsOn = !IsOn;
        screen.Changed(this);
    }
}

// Turns the camera on and off. The screen can also turn it off. Leave as is.
public class CameraButton(ICallScreen screen)
{
    public bool IsOn { get; private set; }

    public void Press()
    {
        IsOn = !IsOn;
        screen.Changed(this);
    }

    public void TurnOff() => IsOn = false;
}

// Starts and stops sharing the screen. The screen can also stop it. Leave as is.
public class ShareButton(ICallScreen screen)
{
    public bool IsSharing { get; private set; }

    public void Press()
    {
        IsSharing = !IsSharing;
        screen.Changed(this);
    }

    public void Stop() => IsSharing = false;
}

// Raises and lowers your hand. The screen can also lower it.
public class HandButton(ICallScreen screen)
{
    public bool IsRaised { get; private set; }

    public void Press()
    {
        // TODO: raise the hand when it is down and lower it when it is up, then tell the screen that this button changed.
    }

    public void Lower() => IsRaised = false;
}

// The line at the bottom of the call window. It only shows what it is told. Leave as is.
public class StatusLine
{
    public string Text { get; private set; } = "";

    public void Show(string text) => Text = text;
}

// Builds the buttons, gives each of them itself, and holds the rules about who reacts.
public class CallScreen : ICallScreen
{
    public MicButton Mic { get; }
    public CameraButton Camera { get; }
    public ShareButton Share { get; }
    public HandButton Hand { get; }
    public StatusLine Status { get; } = new();

    public CallScreen()
    {
        Mic = new(this);
        Camera = new(this);
        Share = new(this);
        Hand = new(this);
        Show();
    }

    public void Changed(object button)
    {
        // Starting to share turns the camera off. It is finished: use it as the model for the other rules.
        if (button == Share && Share.IsSharing) Camera.TurnOff();
        // TODO: turning the camera on stops sharing.
        // TODO: turning the mic on lowers a raised hand.
        Show();
    }

    private void Show() => Status.Show(
        $"mic {(Mic.IsOn ? "on" : "off")}, camera {(Camera.IsOn ? "on" : "off")}, " +
        $"{(Share.IsSharing ? "sharing" : "not sharing")}, hand {(Hand.IsRaised ? "up" : "down")}");
}
