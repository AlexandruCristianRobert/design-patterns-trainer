using System.Reflection;
using DesignPatterns.Checks;

static class LobbyChecks
{
    // What a player has seen so far, such as "Ben joined | Ben is ready", or "nothing".
    static string Seen(Player player) => player.Seen.Count == 0 ? "nothing" : string.Join(" | ", player.Seen);

    static void SawAll(Player player, string expected, string after)
    {
        var actual = Seen(player);
        Expect.That(actual == expected, "wrongSeen", new { player = player.Name, after, expected, actual });
    }

    static void Running(Lobby lobby, bool expected, string after)
    {
        var actual = lobby.Countdown.IsRunning;
        Expect.That(actual == expected, "wrongCountdown", new { after, expected, actual });
    }

    [Check("players-see-each-other-change")]
    static void PlayersSeeEachOtherChange()
    {
        var lobby = new Lobby();
        var ana = lobby.Join("Ana");
        var ben = lobby.Join("Ben");
        var cleo = lobby.Join("Cleo");
        var names = string.Join(", ", lobby.Players.Select(p => p.Name));
        Expect.That(names == "Ana, Ben, Cleo", "wrongPlayers", new { after = "Ana, Ben and Cleo joined", expected = "Ana, Ben, Cleo", actual = names });
        Expect.That(!ana.IsReady, "readyAtStart", new { expected = false, actual = ana.IsReady });
        SawAll(ana, "Ben joined | Cleo joined", "Ana, Ben and Cleo joined");
        SawAll(ben, "Cleo joined", "Ana, Ben and Cleo joined");
        SawAll(cleo, "nothing", "Ana, Ben and Cleo joined");

        ana.Ready();
        Expect.That(ana.IsReady, "notReady", new { expected = true, actual = ana.IsReady });
        SawAll(ana, "Ben joined | Cleo joined", "Ana got ready");
        SawAll(ben, "Cleo joined | Ana is ready", "Ana got ready");
        SawAll(cleo, "Ana is ready", "Ana got ready");

        ana.Ready();
        ben.Unready();
        SawAll(cleo, "Ana is ready", "Ana got ready again and Ben, who was not ready, got not ready");

        ana.Unready();
        Expect.That(!ana.IsReady, "stillReady", new { expected = false, actual = ana.IsReady });
        SawAll(ben, "Cleo joined | Ana is ready | Ana is not ready", "Ana got not ready");
        SawAll(cleo, "Ana is ready | Ana is not ready", "Ana got not ready");
    }

    [Check("everyone-ready-starts-the-countdown")]
    static void EveryoneReadyStartsTheCountdown()
    {
        var lobby = new Lobby();
        var ana = lobby.Join("Ana");
        ana.Ready();
        Running(lobby, false, "Ana, alone in the lobby, got ready");

        var ben = lobby.Join("Ben");
        Running(lobby, false, "Ben joined");
        ben.Ready();
        Running(lobby, true, "Ben got ready too");
        SawAll(ana, "Ben joined | Ben is ready | countdown started", "Ben got ready too");
        SawAll(ben, "countdown started", "Ben got ready too");
    }

    [Check("backing-out-stops-the-countdown")]
    static void BackingOutStopsTheCountdown()
    {
        var lobby = new Lobby();
        var ana = lobby.Join("Ana");
        var ben = lobby.Join("Ben");
        ana.Ready();
        ben.Ready();
        ben.Unready();
        Running(lobby, false, "Ana and Ben got ready and then Ben got not ready");
        SawAll(ana, "Ben joined | Ben is ready | countdown started | Ben is not ready | countdown stopped", "Ben got not ready");

        lobby = new Lobby();
        ana = lobby.Join("Ana");
        ben = lobby.Join("Ben");
        ana.Ready();
        ben.Ready();
        var cleo = lobby.Join("Cleo");
        Running(lobby, false, "Ana and Ben got ready and then Cleo joined");
        SawAll(ana, "Ben joined | Ben is ready | countdown started | Cleo joined | countdown stopped", "Cleo joined");
        SawAll(cleo, "countdown stopped", "Cleo joined");

        cleo.Leave();
        var names = string.Join(", ", lobby.Players.Select(p => p.Name));
        Expect.That(names == "Ana, Ben", "wrongPlayers", new { after = "Cleo left", expected = "Ana, Ben", actual = names });
        Running(lobby, true, "Cleo, the only player who was not ready, left");
        SawAll(ben, "Ana is ready | countdown started | Cleo joined | countdown stopped | Cleo left | countdown started", "Cleo left");
        SawAll(cleo, "countdown stopped", "Cleo left");

        ben.Leave();
        Running(lobby, false, "Ben left and Ana was alone");
        SawAll(ana, "Ben joined | Ben is ready | countdown started | Cleo joined | countdown stopped | Cleo left | countdown started | Ben left | countdown stopped", "Ben left");
    }

    [Check("cancelling-unreadies-everyone")]
    static void CancellingUnreadiesEveryone()
    {
        var lobby = new Lobby();
        var ana = lobby.Join("Ana");
        var ben = lobby.Join("Ben");
        lobby.Countdown.Cancel();
        SawAll(ana, "Ben joined", "cancelling a countdown that was not running");

        ana.Ready();
        ben.Ready();
        lobby.Countdown.Cancel();
        Running(lobby, false, "cancelling the countdown");
        foreach (var p in new[] { ana, ben })
            Expect.That(!p.IsReady, "stillReadyAfterCancel", new { player = p.Name, expected = false, actual = p.IsReady });
        SawAll(ana, "Ben joined | Ben is ready | countdown started | countdown cancelled", "cancelling the countdown");
        SawAll(ben, "Ana is ready | countdown started | countdown cancelled", "cancelling the countdown");

        ana.Ready();
        SawAll(ben, "Ana is ready | countdown started | countdown cancelled | Ana is ready", "Ana got ready again after the cancel");
    }

    [Check("players-know-only-the-lobby")]
    static void PlayersKnowOnlyTheLobby() => ExpectNoneHoldsAnother([typeof(Player), typeof(Countdown)]);

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

    // The field's name as written: "<name>P" and "<Lobby>k__BackingField" become "name" and "Lobby".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
