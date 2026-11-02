using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class DrawingChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // The group as an IShape, which it has to be for a group to sit inside another group.
    static IShape AsShape(Group group)
    {
        if (group is IShape shape) return shape;
        Expect.Fail("groupNotAShape");
        return null!;
    }

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    // The type a field of `owner` holds besides IShape (object, Box or Group), or null when it holds only IShape values.
    static string? OtherThanShapes(Type owner)
    {
        var fields = owner.GetFields(Declared);
        if (!fields.Any(f => Inside(f.FieldType).Contains(typeof(IShape)))) Expect.Fail("noShapeField", new { type = owner.Name });
        var named = fields.SelectMany(f => Inside(f.FieldType)).FirstOrDefault(t => t == typeof(object) || t == typeof(Box) || t == typeof(Group));
        return named?.Name;
    }

    // Three levels: outer holds a 2x3 box and middle; middle holds a 1x1 box and inner; inner holds a 4x5 and a 2x2 box.
    static (Group Outer, Box Deepest, Box Top) ThreeLevels()
    {
        var deepest = new Box(40, 40, 4, 5);
        var inner = new Group();
        inner.Add(deepest);
        inner.Add(new Box(50, 50, 2, 2));
        var middle = new Group();
        middle.Add(new Box(20, 20, 1, 1));
        middle.Add(inner);
        var top = new Box(0, 0, 2, 3);
        var outer = new Group();
        outer.Add(top);
        outer.Add(middle);
        return (outer, deepest, top);
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "area 39",
            "title at 5,1, dot at 15,1, bar at 17,1, stamp at 35,11",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("group-adds-up-area")]
    static void GroupAddsUpArea()
    {
        var (outer, _, _) = ThreeLevels();
        var area = AsShape(outer).Area();

        Expect.That(area == 31, "wrongArea", new { actual = area });
    }

    [Check("moving-a-group-moves-everything")]
    static void MovingAGroupMovesEverything()
    {
        var (outer, deepest, top) = ThreeLevels();
        AsShape(outer).Move(3, -2);

        Expect.That(top.X == 3 && top.Y == -2, "topNotMoved", new { x = top.X, y = top.Y });
        Expect.That(deepest.X == 43 && deepest.Y == 38, "deepestNotMoved", new { x = deepest.X, y = deepest.Y });
    }

    [Check("empty-group-works")]
    static void EmptyGroupWorks()
    {
        var empty = AsShape(new Group());
        var area = empty.Area();
        empty.Move(1, 1);
        var (outer, _, _) = ThreeLevels();
        outer.Add(new Group());
        var withEmpty = AsShape(outer).Area();

        Expect.That(area == 0, "emptyHasArea", new { actual = area });
        Expect.That(withEmpty == 31, "emptyChangedArea", new { actual = withEmpty });
    }

    [Check("canvas-handles-groups-and-boxes")]
    static void CanvasHandlesGroupsAndBoxes()
    {
        var (outer, deepest, _) = ThreeLevels();
        var loose = new Box(5, 5, 3, 3);
        var canvas = new Canvas();
        canvas.Add(outer);
        canvas.Add(loose);
        var area = canvas.TotalArea();
        canvas.MoveAll(-1, 4);

        Expect.That(area == 40, "wrongCanvasArea", new { actual = area });
        Expect.That(deepest.X == 39 && deepest.Y == 44 && loose.X == 4 && loose.Y == 9, "canvasMissedShape",
            new { deepX = deepest.X, deepY = deepest.Y, looseX = loose.X, looseY = loose.Y });
    }

    [Check("one-shape-interface")]
    static void OneShapeInterface()
    {
        Expect.That(typeof(IShape).IsAssignableFrom(typeof(Group)), "groupNotAShape");

        var groupHolds = OtherThanShapes(typeof(Group));
        Expect.That(groupHolds is null, "holdsOther", new { type = "Group", held = groupHolds });
        var canvasHolds = OtherThanShapes(typeof(Canvas));
        Expect.That(canvasHolds is null, "holdsOther", new { type = "Canvas", held = canvasHolds });

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
                     .Where(d => d.Identifier.ValueText is "Group" or "Canvas"))
        {
            var checks = declaration.DescendantNodes().Any(n =>
                n is DeclarationPatternSyntax or TypePatternSyntax or RecursivePatternSyntax { Type: not null }
                || n is BinaryExpressionSyntax { OperatorToken.ValueText: "is" or "as" });
            Expect.That(!checks, "typeCheckLeft", new { type = declaration.Identifier.ValueText });
        }
    }
}
