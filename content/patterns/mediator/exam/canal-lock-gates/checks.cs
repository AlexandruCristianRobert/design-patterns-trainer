using System.Reflection;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using DesignPatterns.Checks;

static class CanalLockChecks
{
    // The whole lock at once, such as "upper closed, lower open, filling closed, emptying closed, water low".
    static string Now(CanalLock canal) =>
        $"upper {Said(canal.Upper.IsOpen)}, lower {Said(canal.Lower.IsOpen)}, " +
        $"filling {Said(canal.Filling.IsOpen)}, emptying {Said(canal.Emptying.IsOpen)}, water {canal.Water}";

    static string Said(bool open) => open ? "open" : "closed";

    static void Step(CanalLock canal, Action action, string said, string expected)
    {
        action();
        var actual = Now(canal);
        Expect.That(actual == expected, "wrongLock", new { step = said, expected, actual });
    }

    [Check("gates-open-only-on-their-side")]
    static void GatesOpenOnlyOnTheirSide()
    {
        var canal = new CanalLock();
        var start = Now(canal);
        Expect.That(start == "upper closed, lower closed, filling closed, emptying closed, water low", "wrongStart",
            new { expected = "upper closed, lower closed, filling closed, emptying closed, water low", actual = start });

        Step(canal, () => canal.Upper.Open(), "opening the upper gate with the water low", "upper closed, lower closed, filling closed, emptying closed, water low");
        Step(canal, () => canal.Lower.Open(), "opening the lower gate with the water low", "upper closed, lower open, filling closed, emptying closed, water low");
        Step(canal, () => canal.Lower.Close(), "closing the lower gate", "upper closed, lower closed, filling closed, emptying closed, water low");
        Step(canal, () => canal.Filling.Open(), "opening the filling paddle", "upper closed, lower closed, filling open, emptying closed, water high");
        Step(canal, () => canal.Filling.Close(), "closing the filling paddle", "upper closed, lower closed, filling closed, emptying closed, water high");
        Step(canal, () => canal.Lower.Open(), "opening the lower gate with the water high", "upper closed, lower closed, filling closed, emptying closed, water high");
        Step(canal, () => canal.Upper.Open(), "opening the upper gate with the water high", "upper open, lower closed, filling closed, emptying closed, water high");
    }

    [Check("paddles-move-the-water")]
    static void PaddlesMoveTheWater()
    {
        var canal = new CanalLock();
        Step(canal, () => canal.Emptying.Open(), "opening the emptying paddle", "upper closed, lower closed, filling closed, emptying open, water low");
        Step(canal, () => canal.Filling.Open(), "opening the filling paddle while the emptying one is open", "upper closed, lower closed, filling closed, emptying open, water low");
        Step(canal, () => canal.Emptying.Close(), "closing the emptying paddle", "upper closed, lower closed, filling closed, emptying closed, water low");
        Step(canal, () => canal.Filling.Open(), "opening the filling paddle", "upper closed, lower closed, filling open, emptying closed, water high");
        Step(canal, () => canal.Emptying.Open(), "opening the emptying paddle while the filling one is open", "upper closed, lower closed, filling open, emptying closed, water high");
        Step(canal, () => canal.Filling.Close(), "closing the filling paddle", "upper closed, lower closed, filling closed, emptying closed, water high");
        Step(canal, () => canal.Emptying.Open(), "opening the emptying paddle", "upper closed, lower closed, filling closed, emptying open, water low");
    }

    [Check("nothing-opens-while-water-can-flow")]
    static void NothingOpensWhileWaterCanFlow()
    {
        var canal = new CanalLock();
        canal.Lower.Open();
        Step(canal, () => canal.Filling.Open(), "opening the filling paddle while the lower gate is open", "upper closed, lower open, filling closed, emptying closed, water low");
        Step(canal, () => canal.Emptying.Open(), "opening the emptying paddle while the lower gate is open", "upper closed, lower open, filling closed, emptying closed, water low");
        canal.Lower.Close();
        canal.Filling.Open();
        Step(canal, () => canal.Upper.Open(), "opening the upper gate while the filling paddle is open", "upper closed, lower closed, filling open, emptying closed, water high");
        canal.Filling.Close();
        canal.Upper.Open();
        Step(canal, () => canal.Emptying.Open(), "opening the emptying paddle while the upper gate is open", "upper open, lower closed, filling closed, emptying closed, water high");
    }

    [Check("gates-and-paddles-know-only-the-lock")]
    static void GatesAndPaddlesKnowOnlyTheLock() => ExpectNoneHoldsAnother([typeof(Gate), typeof(Paddle)]);

    [Check("no-part-reaches-another-through-the-lock")]
    static void NoPartReachesAnotherThroughTheLock() =>
        ExpectNoneReachesThrough(typeof(CanalLock), [typeof(Gate), typeof(Paddle)]);

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

    // The field's name as written: "<keeper>P" and "<IsOpen>k__BackingField" become "keeper" and "IsOpen".
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
