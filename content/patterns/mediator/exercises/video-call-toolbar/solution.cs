// The buttons know only the call screen. A button says "I changed", and the screen decides who reacts.
var call = new CallScreen();
call.Camera.Press();
call.Share.Press();
Console.WriteLine($"camera on: {call.Camera.IsOn}, sharing: {call.Share.IsSharing}");
call.Camera.Press();
Console.WriteLine($"camera on: {call.Camera.IsOn}, sharing: {call.Share.IsSharing}");

// What every button talks to. A button calls Changed with itself after the user presses it.
public interface ICallScreen
{
    void Changed(object button);
}

// Turns the camera on and off. The screen can also turn it off.
public class CameraButton(ICallScreen screen)
{
    public bool IsOn { get; private set; }

    public void Press()
    {
        IsOn = !IsOn;
        screen.Changed(this);
    }

    // Used by the screen: turns the camera off without telling anyone.
    public void TurnOff() => IsOn = false;
}

// Starts and stops sharing your screen. The screen can also stop it.
public class ShareButton(ICallScreen screen)
{
    public bool IsSharing { get; private set; }

    public void Press()
    {
        IsSharing = !IsSharing;
        screen.Changed(this);
    }

    // Used by the screen: stops sharing without telling anyone.
    public void Stop() => IsSharing = false;
}

// Builds the buttons, gives each of them itself, and holds the rules about who reacts.
public class CallScreen : ICallScreen
{
    public CameraButton Camera { get; }
    public ShareButton Share { get; }

    public CallScreen()
    {
        Camera = new(this);
        Share = new(this);
    }

    public void Changed(object button)
    {
        // Starting to share turns the camera off. It is finished: use it as the model.
        if (button == Share && Share.IsSharing) Camera.TurnOff();
        // Turning the camera on stops sharing.
        if (button == Camera && Camera.IsOn) Share.Stop();
    }
}
