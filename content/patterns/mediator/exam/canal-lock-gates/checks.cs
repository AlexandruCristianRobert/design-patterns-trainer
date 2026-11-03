using System.Reflection;
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
}
