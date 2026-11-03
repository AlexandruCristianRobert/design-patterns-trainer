using System.Reflection;
using DesignPatterns.Checks;

static class ChatRoomChecks
{
    // What a member has heard so far, such as "Ben joined | Ben: hi", or "nothing".
    static void HeardAll(Member member, string expected, string after)
    {
        var actual = member.Heard.Count == 0 ? "nothing" : string.Join(" | ", member.Heard);
        Expect.That(actual == expected, "wrongHeard", new { member = member.Name, after, expected, actual });
    }

    [Check("everyone-else-hears-what-is-said")]
    static void EveryoneElseHearsWhatIsSaid()
    {
        var room = new ChatRoom();
        var ana = room.Enter("Ana");
        var ben = room.Enter("Ben");
        var cleo = room.Enter("Cleo");
        var names = string.Join(", ", room.Members.Select(m => m.Name));
        Expect.That(names == "Ana, Ben, Cleo", "wrongMembers", new { after = "Ana, Ben and Cleo came in", expected = "Ana, Ben, Cleo", actual = names });

        ben.Say("hi all");
        HeardAll(ana, "Ben joined | Cleo joined | Ben: hi all", "Ben said hi all");
        HeardAll(ben, "Cleo joined", "Ben said hi all");
        HeardAll(cleo, "Ben: hi all", "Ben said hi all");
    }

    [Check("muted-members-are-not-heard")]
    static void MutedMembersAreNotHeard()
    {
        var room = new ChatRoom();
        var ana = room.Enter("Ana");
        var ben = room.Enter("Ben");
        var cleo = room.Enter("Cleo");
        cleo.Mute("Ana");
        ana.Say("one");
        ben.Say("two");
        ana.Whisper("Cleo", "three");
        HeardAll(cleo, "Ben: two", "Cleo muted Ana, Ana said one, Ben said two and Ana whispered to Cleo");
        HeardAll(ben, "Cleo joined | Ana: one", "Cleo muted Ana and Ana said one");

        ana.Leave();
        HeardAll(cleo, "Ben: two | Ana left", "Ana left");
    }

    [Check("whispers-reach-one-member")]
    static void WhispersReachOneMember()
    {
        var room = new ChatRoom();
        var ana = room.Enter("Ana");
        var ben = room.Enter("Ben");
        var cleo = room.Enter("Cleo");
        ana.Whisper("Cleo", "psst");
        HeardAll(cleo, "Ana whispers: psst", "Ana whispered to Cleo");
        HeardAll(ben, "Cleo joined", "Ana whispered to Cleo");
        HeardAll(ana, "Ben joined | Cleo joined", "Ana whispered to Cleo");

        ana.Whisper("Dev", "hello?");
        HeardAll(ana, "Ben joined | Cleo joined | Dev is not here", "Ana whispered to Dev, who is not in the room");
    }

    [Check("members-who-left-hear-and-say-nothing")]
    static void MembersWhoLeftHearAndSayNothing()
    {
        var room = new ChatRoom();
        var ana = room.Enter("Ana");
        var ben = room.Enter("Ben");
        ben.Leave();
        var names = string.Join(", ", room.Members.Select(m => m.Name));
        Expect.That(names == "Ana", "wrongMembers", new { after = "Ben left", expected = "Ana", actual = names });
        HeardAll(ana, "Ben joined | Ben left", "Ben left");

        ana.Say("anyone?");
        ben.Say("I am still here");
        ben.Whisper("Ana", "me too");
        var cleo = room.Enter("Cleo");
        HeardAll(ben, "nothing", "Ben left, Ana spoke and Cleo came in");
        HeardAll(ana, "Ben joined | Ben left | Cleo joined", "Ben, who had left, spoke and whispered");
        HeardAll(cleo, "nothing", "Ben, who had left, spoke and whispered");
    }

    [Check("members-know-only-the-room")]
    static void MembersKnowOnlyTheRoom() => ExpectNoneHoldsAnother([typeof(Member)]);

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

    // The field's name as written: "<room>P" and "<Name>k__BackingField" become "room" and "Name".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
