using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class TabletKeyChecks
{
    static string Looks(Sketch sketch) => $"zoom {sketch.Zoom}, layers {sketch.Layers}, grid {(sketch.Grid ? "on" : "off")}";

    // A sketch at zoom 150, with 3 layers and the grid on.
    static Sketch Worked()
    {
        var sketch = new Sketch();
        sketch.SetZoom(150);
        sketch.SetLayers(3);
        sketch.SetGrid(true);
        return sketch;
    }

    // Keys 1, 2 and 3 given ZoomIn, AddLayer and ToggleGrid on the sketch.
    static ExpressKeys Keys(Sketch sketch)
    {
        var keys = new ExpressKeys();
        keys.Assign(1, new ZoomIn(sketch));
        keys.Assign(2, new AddLayer(sketch));
        keys.Assign(3, new ToggleGrid(sketch));
        return keys;
    }

    [Check("each-action-performs-and-takes-itself-back")]
    static void EachActionPerformsAndTakesItselfBack()
    {
        var sketch = Worked();
        const string start = "zoom 150, layers 3, grid on";

        void Try(KeyAction action, string made, string afterPerform)
        {
            action.Perform();
            var done = Looks(sketch);
            Expect.That(done == afterPerform, "wrongPerform", new { action = made, expected = afterPerform, actual = done });
            action.TakeBack();
            var back = Looks(sketch);
            Expect.That(back == start, "wrongTakeBack", new { action = made, expected = start, actual = back });
        }

        Try(new ZoomIn(sketch), "ZoomIn", "zoom 175, layers 3, grid on");
        Try(new AddLayer(sketch), "AddLayer", "zoom 150, layers 4, grid on");
        Try(new ToggleGrid(sketch), "ToggleGrid", "zoom 150, layers 3, grid off");
    }

    [Check("each-key-performs-its-action")]
    static void EachKeyPerformsItsAction()
    {
        var sketch = new Sketch();
        var keys = Keys(sketch);
        keys.Press(1);
        keys.Press(1);
        keys.Press(2);
        keys.Press(3);
        var pressed = Looks(sketch);
        Expect.That(pressed == "zoom 150, layers 2, grid on", "wrongPress",
            new { presses = "1, 1, 2 and 3", expected = "zoom 150, layers 2, grid on", actual = pressed });

        keys.Press(4);
        var unassigned = Looks(sketch);
        Expect.That(unassigned == "zoom 150, layers 2, grid on", "unassignedDidSomething",
            new { expected = "zoom 150, layers 2, grid on", actual = unassigned });
    }

    [Check("a-key-can-be-given-another-action")]
    static void AKeyCanBeGivenAnotherAction()
    {
        var sketch = new Sketch();
        var keys = Keys(sketch);
        keys.Press(1);
        keys.Assign(1, new ToggleGrid(sketch));
        keys.Assign(2, new ZoomIn(sketch));
        keys.Press(1);
        keys.Press(2);
        var now = Looks(sketch);
        Expect.That(now == "zoom 150, layers 1, grid on", "wrongReassign",
            new { expected = "zoom 150, layers 1, grid on", actual = now });
    }

    [Check("take-back-goes-back-one-press-at-a-time")]
    static void TakeBackGoesBackOnePressAtATime()
    {
        var sketch = new Sketch();
        var keys = Keys(sketch);
        keys.Press(1);
        keys.Press(2);
        keys.Press(2);
        keys.Press(4);
        keys.Press(3);
        keys.Assign(3, new AddLayer(sketch));
        keys.Press(1);
        keys.Press(3);

        string[] expected =
        [
            "zoom 150, layers 3, grid on",
            "zoom 125, layers 3, grid on",
            "zoom 125, layers 3, grid off",
            "zoom 125, layers 2, grid off",
            "zoom 125, layers 1, grid off",
            "zoom 100, layers 1, grid off",
            "zoom 100, layers 1, grid off",
        ];
        for (var i = 0; i < expected.Length; i++)
        {
            keys.TakeBackLast();
            var now = Looks(sketch);
            Expect.That(now == expected[i], "wrongTakeBack", new { steps = i + 1, expected = expected[i], actual = now });
        }
    }

    [Check("the-keys-know-only-key-actions")]
    static void TheKeysKnowOnlyKeyActions()
    {
        var action = typeof(KeyAction);
        foreach (var type in new[] { typeof(ZoomIn), typeof(AddLayer), typeof(ToggleGrid) })
            Expect.That(action.IsAssignableFrom(type), "notAKeyAction", new { type = type.Name });

        foreach (var field in typeof(ExpressKeys).GetFields(AnyField))
            foreach (var concrete in new[] { typeof(ZoomIn), typeof(AddLayer), typeof(ToggleGrid), typeof(Sketch) })
                Expect.That(!Involves(field.FieldType, concrete), "keysHoldConcrete", new { field = field.Name, type = concrete.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "ExpressKeys")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "ZoomIn" or "AddLayer" or "ToggleGrid" or "Sketch");
        Expect.That(named is null, "keysNameConcrete", new { type = named?.Identifier.ValueText });
    }

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));
}
