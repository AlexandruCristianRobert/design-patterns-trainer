using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using DesignPatterns.Checks;

static class VideoCallChecks
{
    // Stands in for the call screen and keeps every button that said it changed.
    sealed class Recorder : ICallScreen
    {
        public List<object> Told { get; } = [];
        public void Changed(object button) => Told.Add(button);
    }

    [Check("the-hand-button-tells-the-screen")]
    static void TheHandButtonTellsTheScreen()
    {
        var screen = new Recorder();
        var hand = new HandButton(screen);

        hand.Press();
        Expect.That(hand.IsRaised, "notRaised", new { presses = 1, expected = true, actual = hand.IsRaised });
        Expect.That(screen.Told.Count == 1 && screen.Told[0] == hand, "notTold", new { presses = 1, expected = 1, actual = screen.Told.Count });

        hand.Press();
        Expect.That(!hand.IsRaised, "notRaised", new { presses = 2, expected = false, actual = hand.IsRaised });
        Expect.That(screen.Told.Count == 2 && screen.Told[1] == hand, "notTold", new { presses = 2, expected = 2, actual = screen.Told.Count });
    }

    [Check("turning-the-camera-on-stops-sharing")]
    static void TurningTheCameraOnStopsSharing()
    {
        var call = new CallScreen();
        call.Share.Press();
        Expect.That(call.Share.IsSharing, "notSharing", new { expected = true, actual = call.Share.IsSharing });

        call.Camera.Press();
        Expect.That(call.Camera.IsOn, "cameraOff", new { expected = true, actual = call.Camera.IsOn });
        Expect.That(!call.Share.IsSharing, "stillSharing", new { expected = false, actual = call.Share.IsSharing });

        // Turning the camera off again does not start sharing.
        call.Camera.Press();
        Expect.That(!call.Share.IsSharing, "sharingAgain", new { expected = false, actual = call.Share.IsSharing });
    }

    [Check("turning-the-mic-on-lowers-the-hand")]
    static void TurningTheMicOnLowersTheHand()
    {
        var call = new CallScreen();
        call.Hand.Press();
        Expect.That(call.Hand.IsRaised, "handNotRaised", new { expected = true, actual = call.Hand.IsRaised });

        call.Mic.Press();
        Expect.That(call.Mic.IsOn, "micOff", new { expected = true, actual = call.Mic.IsOn });
        Expect.That(!call.Hand.IsRaised, "handStillUp", new { expected = false, actual = call.Hand.IsRaised });

        // With the mic on, the hand can be raised again, and turning the mic off leaves it up.
        call.Hand.Press();
        call.Mic.Press();
        Expect.That(call.Hand.IsRaised, "handLoweredByMute", new { expected = true, actual = call.Hand.IsRaised });
    }

    [Check("the-status-line-follows-every-change")]
    static void TheStatusLineFollowsEveryChange()
    {
        var call = new CallScreen();
        (Action Press, string Said, string Expected)[] steps =
        [
            (call.Camera.Press, "the camera", "mic off, camera on, not sharing, hand down"),
            (call.Share.Press, "share", "mic off, camera off, sharing, hand down"),
            (call.Hand.Press, "the hand", "mic off, camera off, sharing, hand up"),
            (call.Camera.Press, "the camera", "mic off, camera on, not sharing, hand up"),
            (call.Mic.Press, "the mic", "mic on, camera on, not sharing, hand down"),
        ];
        for (var i = 0; i < steps.Length; i++)
        {
            steps[i].Press();
            var actual = call.Status.Text;
            Expect.That(actual == steps[i].Expected, "wrongStatus", new { step = i + 1, button = steps[i].Said, expected = steps[i].Expected, actual });
        }
    }

    [Check("the-buttons-know-only-the-screen")]
    static void TheButtonsKnowOnlyTheScreen() =>
        ExpectNoneHoldsAnother([typeof(MicButton), typeof(CameraButton), typeof(ShareButton), typeof(HandButton), typeof(StatusLine)]);

    [Check("no-button-reaches-another-through-the-screen")]
    static void NoButtonReachesAnotherThroughTheScreen() =>
        ExpectNoneReachesThrough(typeof(CallScreen), [typeof(MicButton), typeof(CameraButton), typeof(ShareButton), typeof(HandButton), typeof(StatusLine)]);

    // ---- No part holds another ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No field of a part, or of a class it inherits from, can hold one of the parts: typed as the part, as a class or
    // interface of ours that the part is, or as an array, list or other collection of them. Fields typed object and
    // delegates do not count.
    static void ExpectNoneHoldsAnother(Type[] parts)
    {
        foreach (var part in parts)
            for (var type = part; type is not null && type != typeof(object); type = type.BaseType)
                foreach (var field in type.GetFields(AnyField))
                    foreach (var other in parts)
                        Expect.That(!Holds(field.FieldType, other), "holdsAnother",
                            new { type = part.Name, field = Shown(field), other = other.Name });
    }

    static bool Holds(Type fieldType, Type part) =>
        fieldType != typeof(object) && !typeof(Delegate).IsAssignableFrom(fieldType)
        && (part.IsAssignableFrom(fieldType)
            || fieldType.Assembly == part.Assembly && fieldType.IsAssignableFrom(part)
            || fieldType.HasElementType && Holds(fieldType.GetElementType()!, part)
            || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, part)));

    // The field's name as written: "<screen>P" and "<Text>k__BackingField" become "screen" and "Text".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;

    // ---- No part reaches another through the hub ----

    // Inside a part, nothing reads a member of the hub that can hold a part (a property or field typed as a part, as a
    // class or interface of ours that a part is, or as a collection of them) through the part's own field or property
    // that holds the hub: `hub.Member`, `this.hub.Member`, `hub!.Member` or `hub?.Member`.
    static void ExpectNoneReachesThrough(Type hub, Type[] parts)
    {
        var held = new HashSet<string>();
        for (var type = hub; type is not null && type != typeof(object); type = type.BaseType)
        {
            foreach (var property in type.GetProperties(AnyField))
                if (parts.Any(p => Holds(property.PropertyType, p))) held.Add(property.Name);
            foreach (var field in type.GetFields(AnyField))
                if (!field.Name.StartsWith('<') && parts.Any(p => Holds(field.FieldType, p))) held.Add(field.Name);
        }

        foreach (var part in parts)
        {
            var receivers = new HashSet<string>();
            for (var type = part; type is not null && type != typeof(object); type = type.BaseType)
            {
                foreach (var field in type.GetFields(AnyField))
                    if (HoldsHub(field.FieldType, hub)) receivers.Add(Shown(field));
                foreach (var property in type.GetProperties(AnyField))
                    if (HoldsHub(property.PropertyType, hub)) receivers.Add(property.Name);
            }
            if (receivers.Count == 0) continue;

            foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == part.Name))
                foreach (var node in declaration.DescendantNodes())
                {
                    (string? receiver, string? member) = node switch
                    {
                        MemberAccessExpressionSyntax m => (Receiver(m.Expression), m.Name.Identifier.ValueText),
                        ConditionalAccessExpressionSyntax c => (Receiver(c.Expression),
                            c.WhenNotNull.DescendantNodesAndSelf().OfType<MemberBindingExpressionSyntax>().FirstOrDefault()?.Name.Identifier.ValueText),
                        _ => (null, null),
                    };
                    var reaches = receiver is not null && member is not null && receivers.Contains(receiver) && held.Contains(member);
                    Expect.That(!reaches, "reachesThrough", new { type = part.Name, code = $"{receiver}.{member}" });
                }
        }
    }

    // The name a hub is read through: `hub`, `this.hub`, `(hub)` or `hub!`; null for anything else.
    static string? Receiver(ExpressionSyntax expression) => expression switch
    {
        IdentifierNameSyntax i => i.Identifier.ValueText,
        MemberAccessExpressionSyntax { Expression: ThisExpressionSyntax } m => m.Name.Identifier.ValueText,
        ParenthesizedExpressionSyntax p => Receiver(p.Expression),
        PostfixUnaryExpressionSyntax u when u.OperatorToken.ValueText == "!" => Receiver(u.Operand),
        _ => null,
    };

    // A field or property of this type can hold the hub: the hub itself, or a class or interface of ours that it is.
    static bool HoldsHub(Type type, Type hub) =>
        type != typeof(object) && type.Assembly == hub.Assembly && type.IsAssignableFrom(hub);
}
