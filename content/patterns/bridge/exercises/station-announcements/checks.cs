using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class StationChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly string[] PairClasses = ["DelayOnSpeakers", "DelayOnScreen", "PlatformChangeOnSpeakers", "PlatformChangeOnScreen"];

    // True when `type` or one of its base classes keeps an instance field of type `held`.
    static bool Keeps(Type type, Type held)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            if (t.GetFields(Declared).Any(f => f.FieldType == held)) return true;
        return false;
    }

    // No class that is `top` or derives from it names one of the program's classes that implement or derive from `held`.
    static void NamesNoChannelClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesChannel", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    // A new object of the class called `name`, made through its public constructor without parameters.
    static object NewChannel(string name)
    {
        var type = Code.Type(name).Clr;
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = name });
        return ctor.Invoke(null);
    }

    // A new announcement of the class called `name`, made through its public constructor (channel, train, number).
    static object NewAnnouncement(string name, object channel, string train, int number)
    {
        var type = Code.Type(name).Clr;
        var ctor = type.GetConstructors().FirstOrDefault(c => c.GetParameters() is [var a, var b, var n]
            && a.ParameterType.IsInstanceOfType(channel) && b.ParameterType == typeof(string) && n.ParameterType == typeof(int));
        if (ctor is null) Expect.Fail("noAnnouncementConstructor", new { type = name, channel = channel.GetType().Name });
        return ctor.Invoke([channel, train, number]);
    }

    // What the announcement's public Announce() returns.
    static string Announce(object announcement)
    {
        var method = announcement.GetType().GetMethod("Announce", Type.EmptyTypes);
        if (method is null || method.ReturnType != typeof(string)) Expect.Fail("noAnnounce", new { type = announcement.GetType().Name });
        return (string)method.Invoke(announcement, null)!;
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Ding dong. 9:15 to York: delayed by 10 minutes.",
            "9:15 TO YORK | delayed by 10 minutes",
            "Ding dong. 10:02 to Leeds: now leaving from platform 4.",
            "10:02 TO LEEDS | now leaving from platform 4",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("every-announcement-on-every-channel")]
    static void EveryAnnouncementOnEveryChannel()
    {
        (string Announcement, int Number, string Channel, string Expected)[] pairs =
        [
            ("Delay", 7, "Speakers", "Ding dong. Test train: delayed by 7 minutes."),
            ("Delay", 7, "InfoScreen", "TEST TRAIN | delayed by 7 minutes"),
            ("PlatformChange", 2, "Speakers", "Ding dong. Test train: now leaving from platform 2."),
            ("PlatformChange", 2, "InfoScreen", "TEST TRAIN | now leaving from platform 2"),
        ];
        foreach (var (announcement, number, channel, expected) in pairs)
        {
            var actual = Announce(NewAnnouncement(announcement, NewChannel(channel), "Test train", number));
            Expect.That(actual == expected, "wrongPair", new { announcement, number, channel, actual, expected });
        }
    }

    [Check("announcements-hold-a-channel")]
    static void AnnouncementsHoldAChannel()
    {
        var channel = Code.Type("Channel").Clr;
        Expect.That(channel.IsInterface || channel.IsAbstract, "channelNotAbstract");
        var present = channel.GetMethod("Present", [typeof(string), typeof(string)]);
        Expect.That(present is not null && present.ReturnType == typeof(string), "noPresent");
        foreach (var name in new[] { "Speakers", "InfoScreen" })
            Expect.That(channel.IsAssignableFrom(Code.Type(name).Clr), "notAChannel", new { type = name });

        var announcement = Code.Type("Announcement").Clr;
        var announce = announcement.GetMethod("Announce", Type.EmptyTypes);
        Expect.That(announce is not null && announce.ReturnType == typeof(string), "noAnnounce", new { type = "Announcement" });
        foreach (var name in new[] { "Delay", "PlatformChange" })
        {
            var type = Code.Type(name).Clr;
            Expect.That(announcement.IsAssignableFrom(type), "notAnAnnouncement", new { type = name });
            Expect.That(Keeps(type, channel), "holdsNoChannel", new { type = name });
        }

        var left = PairClasses.FirstOrDefault(n => channel.Assembly.GetTypes().Any(t => t.Name == n));
        Expect.That(left is null, "pairClassLeft", new { type = left });
        NamesNoChannelClass(announcement, channel);
    }
}
