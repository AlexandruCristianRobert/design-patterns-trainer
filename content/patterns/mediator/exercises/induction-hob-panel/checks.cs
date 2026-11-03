using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using DesignPatterns.Checks;

static class HobChecks
{
    // The four levels, such as "5 8 9 0".
    static string Levels(Hob hob) => string.Join(" ", hob.Zones.Select(z => z.Level));

    // Sets one zone and compares the four levels afterwards.
    static void Set(Hob hob, int zone, int level, string expected)
    {
        hob.Zones[zone].SetLevel(level);
        var actual = Levels(hob);
        Expect.That(actual == expected, "wrongLevels", new { zone = zone + 1, level, expected, actual });
    }

    static void HoodIs(Hob hob, int expected, string after)
    {
        var actual = hob.Hood.Speed;
        Expect.That(actual == expected, "wrongHood", new { after, levels = Levels(hob), expected, actual });
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "zones 0 0 0 0, hood 0, lock off",
            "zones 5 0 0 0, hood 1, lock off",
            "zones 5 9 0 0, hood 2, lock off",
            "zones 5 8 9 0, hood 3, lock off",
            "zones 5 8 9 2, hood 3, lock off",
            "zones 0 0 0 0, hood 0, lock on",
            "zones 0 0 0 0, hood 0, lock on",
            "zones 6 0 0 0, hood 1, lock off",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("only-one-zone-boosts")]
    static void OnlyOneZoneBoosts()
    {
        var hob = new Hob();
        Expect.That(hob.Zones.Count == 4, "wrongZoneCount", new { expected = 4, actual = hob.Zones.Count });
        Set(hob, 0, 9, "9 0 0 0");
        Set(hob, 1, 9, "8 9 0 0");
        Set(hob, 2, 9, "8 8 9 0");
        Set(hob, 2, 4, "8 8 4 0");
        Set(hob, 3, 9, "8 8 4 9");
        Set(hob, 0, 7, "7 8 4 9");
    }

    [Check("the-hood-follows-the-zones")]
    static void TheHoodFollowsTheZones()
    {
        var hob = new Hob();
        HoodIs(hob, 0, "nothing");
        (int Zone, int Level, int Hood)[] steps = [(1, 3, 1), (3, 6, 2), (0, 1, 3), (2, 9, 3), (3, 0, 3), (1, 0, 2), (0, 0, 1), (2, 0, 0)];
        foreach (var (zone, level, hood) in steps)
        {
            hob.Zones[zone].SetLevel(level);
            HoodIs(hob, hood, $"setting zone {zone + 1} to {level}");
        }
    }

    [Check("the-child-lock-keeps-the-zones-off")]
    static void TheChildLockKeepsTheZonesOff()
    {
        var hob = new Hob();
        hob.Zones[0].SetLevel(4);
        hob.Zones[2].SetLevel(9);

        hob.Lock.Press();
        Expect.That(hob.Lock.IsOn, "lockNotOn", new { expected = true, actual = hob.Lock.IsOn });
        Expect.That(Levels(hob) == "0 0 0 0", "notSwitchedOff", new { expected = "0 0 0 0", actual = Levels(hob) });
        HoodIs(hob, 0, "turning the child lock on");

        Set(hob, 1, 5, "0 0 0 0");
        HoodIs(hob, 0, "setting a zone while the child lock is on");

        hob.Lock.Press();
        Expect.That(!hob.Lock.IsOn, "lockNotOff", new { expected = false, actual = hob.Lock.IsOn });
        Set(hob, 1, 5, "0 5 0 0");
        HoodIs(hob, 1, "turning the child lock off and setting a zone");
    }

    [Check("the-hob-parts-know-only-the-hob")]
    static void TheHobPartsKnowOnlyTheHob() =>
        ExpectNoneHoldsAnother([typeof(CookingZone), typeof(ExtractorHood), typeof(ChildLock)]);

    [Check("no-part-reaches-another-through-the-hob")]
    static void NoPartReachesAnotherThroughTheHob() =>
        ExpectNoneReachesThrough(typeof(Hob), [typeof(CookingZone), typeof(ExtractorHood), typeof(ChildLock)]);

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

    // The field's name as written: "<hob>P" and "<Level>k__BackingField" become "hob" and "Level".
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
