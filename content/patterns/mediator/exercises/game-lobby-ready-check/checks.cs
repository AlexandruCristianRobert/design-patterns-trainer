using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
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

        // No part reads a member of the lobby that holds a part, such as `lobby.Countdown`.
        var held = HeldBy(typeof(Lobby), parts);
        foreach (var (type, member) in MembersRead(parts))
            Expect.That(!held.Contains(member), "reachesThrough", new { type, member });
    }

    const BindingFlags AnyField = BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // The names of the hub's fields and properties that hold a part.
    static HashSet<string> HeldBy(Type hub, Type[] parts) =>
        hub.GetProperties(AnyField).Where(p => parts.Any(part => Holds(p.PropertyType, part))).Select(p => p.Name)
            .Concat(hub.GetFields(AnyField).Where(f => !f.Name.StartsWith('<') && parts.Any(part => Holds(f.FieldType, part))).Select(f => f.Name))
            .ToHashSet();

    // Every member a part reads with `x.Member` or `x?.Member`, inside the part's own class.
    static IEnumerable<(string Type, string Member)> MembersRead(Type[] parts) =>
        from declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
        where parts.Any(p => p.Name == declaration.Identifier.ValueText)
        from name in declaration.DescendantNodes().OfType<SimpleNameSyntax>()
        where name.Parent is MemberAccessExpressionSyntax m && m.Name == name || name.Parent is MemberBindingExpressionSyntax
        select (declaration.Identifier.ValueText, name.Identifier.ValueText);

    // A field holds a part when it is typed as that part, or as an array or collection of them. Delegates do not count.
    static bool Holds(Type fieldType, Type part) =>
        !typeof(Delegate).IsAssignableFrom(fieldType)
        && (part.IsAssignableFrom(fieldType)
            || fieldType.HasElementType && Holds(fieldType.GetElementType()!, part)
            || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, part)));

    // The field's name as written: "<lobby>P" and "<IsReady>k__BackingField" become "lobby" and "IsReady".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
