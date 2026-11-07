using System.Reflection;
using DesignPatterns.Checks;

static class VideoCallChecks
{
    // Stands in for the call screen and keeps every button that said it changed.
    sealed class Recorder : ICallScreen
    {
        public List<object> Told { get; } = [];
        public void Changed(object button) => Told.Add(button);
    }

    [Check("the-share-button-tells-the-screen")]
    static void TheShareButtonTellsTheScreen()
    {
        var screen = new Recorder();
        var share = new ShareButton(screen);

        share.Press();
        Expect.That(share.IsSharing, "notFlipped", new { presses = 1, expected = true, actual = share.IsSharing });
        Expect.That(screen.Told.Count == 1 && screen.Told[0] == share, "notTold", new { presses = 1, expected = 1, actual = screen.Told.Count });

        share.Press();
        Expect.That(!share.IsSharing, "notFlipped", new { presses = 2, expected = false, actual = share.IsSharing });
        Expect.That(screen.Told.Count == 2 && screen.Told[1] == share, "notTold", new { presses = 2, expected = 2, actual = screen.Told.Count });
    }

    [Check("sharing-turns-the-camera-off")]
    static void SharingTurnsTheCameraOff()
    {
        var call = new CallScreen();
        call.Camera.Press();
        call.Share.Press();
        Expect.That(call.Share.IsSharing, "notSharing", new { expected = true, actual = call.Share.IsSharing });
        Expect.That(!call.Camera.IsOn, "cameraStillOn", new { expected = false, actual = call.Camera.IsOn });
    }

    [Check("turning-the-camera-on-stops-sharing")]
    static void TurningTheCameraOnStopsSharing()
    {
        var call = new CallScreen();
        call.Share.Press();
        call.Camera.Press();
        Expect.That(call.Camera.IsOn, "cameraOff", new { expected = true, actual = call.Camera.IsOn });
        Expect.That(!call.Share.IsSharing, "stillSharing", new { expected = false, actual = call.Share.IsSharing });

        // Turning the camera off again changes nothing else.
        call.Camera.Press();
        Expect.That(!call.Share.IsSharing, "sharingAgain", new { expected = false, actual = call.Share.IsSharing });
    }

    [Check("the-buttons-know-only-the-screen")]
    static void TheButtonsKnowOnlyTheScreen()
    {
        Type[] buttons = [typeof(CameraButton), typeof(ShareButton)];
        foreach (var button in buttons)
            foreach (var field in button.GetFields(AnyField))
                foreach (var other in buttons)
                    Expect.That(!Holds(field.FieldType, other), "holdsAnother", new { type = button.Name, field = Shown(field), other = other.Name });
    }

    const BindingFlags AnyField = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A field holds a button when it is typed as that button, or as an array or collection of them. Delegates do not count.
    static bool Holds(Type fieldType, Type button) =>
        !typeof(Delegate).IsAssignableFrom(fieldType)
        && (button.IsAssignableFrom(fieldType)
            || fieldType.HasElementType && Holds(fieldType.GetElementType()!, button)
            || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, button)));

    // The field's name as written: "<screen>P" and "<IsOn>k__BackingField" become "screen" and "IsOn".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
