using System.Reflection;
using DesignPatterns.Checks;

static class LobbyChecks
{
    [Check("everyone-ready-starts-the-countdown")]
    static void EveryoneReadyStartsTheCountdown()
    {
        var lobby = new Lobby();
        var ana = lobby.Join();
        var ben = lobby.Join();
        var cleo = lobby.Join();
        Expect.That(!ana.IsReady, "readyAtStart", new { expected = false, actual = ana.IsReady });
        Expect.That(!lobby.Countdown.IsRunning, "wrongCountdown", new { after = "three players joined", expected = false, actual = lobby.Countdown.IsRunning });

        ana.Ready();
        Expect.That(ana.IsReady, "notReady", new { expected = true, actual = ana.IsReady });
        ben.Ready();
        Expect.That(!lobby.Countdown.IsRunning, "wrongCountdown", new { after = "two of the three players got ready", expected = false, actual = lobby.Countdown.IsRunning });

        cleo.Ready();
        Expect.That(lobby.Countdown.IsRunning, "wrongCountdown", new { after = "all three players got ready", expected = true, actual = lobby.Countdown.IsRunning });
    }

    [Check("cancelling-makes-everyone-not-ready")]
    static void CancellingMakesEveryoneNotReady()
    {
        var lobby = new Lobby();
        var ana = lobby.Join();
        var ben = lobby.Join();
        ana.Ready();
        ben.Ready();

        lobby.Countdown.Cancel();
        Expect.That(!lobby.Countdown.IsRunning, "stillRunning", new { expected = false, actual = lobby.Countdown.IsRunning });
        Expect.That(!ana.IsReady && !ben.IsReady, "stillReady", new { expected = "both not ready", actual = $"Ana ready {ana.IsReady}, Ben ready {ben.IsReady}" });

        // After the cancel, the countdown starts again once everyone is ready again.
        ana.Ready();
        Expect.That(!lobby.Countdown.IsRunning, "wrongRestart", new { after = "only Ana got ready again", expected = false, actual = lobby.Countdown.IsRunning });
        ben.Ready();
        Expect.That(lobby.Countdown.IsRunning, "wrongRestart", new { after = "Ben got ready again too", expected = true, actual = lobby.Countdown.IsRunning });
    }

    [Check("players-know-only-the-lobby")]
    static void PlayersKnowOnlyTheLobby()
    {
        Type[] parts = [typeof(Player), typeof(Countdown)];
        foreach (var part in parts)
            foreach (var field in part.GetFields(AnyField))
                foreach (var other in parts)
                    Expect.That(!Holds(field.FieldType, other), "holdsAnother", new { type = part.Name, field = Shown(field), other = other.Name });
    }

    const BindingFlags AnyField = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A field holds a part when it is typed as that part, or as an array or collection of them.
    static bool Holds(Type fieldType, Type part) =>
        part.IsAssignableFrom(fieldType)
        || fieldType.HasElementType && Holds(fieldType.GetElementType()!, part)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, part));

    // The field's name as written: "<lobby>P" and "<IsReady>k__BackingField" become "lobby" and "IsReady".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
