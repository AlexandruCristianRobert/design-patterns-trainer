using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class WallpaperChecks
{
    static Room Walls(int height, params (string Name, int Width)[] walls)
    {
        var room = new Room(height);
        foreach (var (name, width) in walls) room.AddWall(name, width);
        return room;
    }

    // Three rooms, each with the words the failure messages use for it.
    static (Room Room, string Said)[] Rooms() =>
    [
        (Walls(280, ("north", 400), ("east", 300)), "a room 280 cm high with a north wall of 400 cm and an east wall of 300 cm"),
        (Walls(240, ("north", 360), ("south", 300), ("west", 200)), "a room 240 cm high with walls north 360 cm, south 300 cm and west 200 cm"),
        (Walls(300), "a room 300 cm high with no walls added"),
    ];

    // Works the estimate out for each of the three rooms.
    static void Try(Measure measure, string written, int[] expected)
    {
        var rooms = Rooms();
        for (var i = 0; i < rooms.Length; i++)
        {
            var actual = measure.Amount(rooms[i].Room);
            Expect.That(actual == expected[i], "wrongAmount", new { measure = written, room = rooms[i].Said, expected = expected[i], actual });
        }
    }

    [Check("simple-parts-measure-a-room")]
    static void SimplePartsMeasureARoom()
    {
        var room = Walls(250, ("north", 100), ("north", 420));
        Expect.That(room.WidthOf("north") == 420, "wrongWall", new { expected = 420, actual = room.WidthOf("north") });

        Try(new Length(53), "Length(53)", [53, 53, 53]);
        Try(new WallWidth("north"), "WallWidth(\"north\")", [400, 360, 0]);
        Try(new WallWidth("east"), "WallWidth(\"east\")", [300, 0, 0]);
        Try(new RoomHeight(), "RoomHeight()", [280, 240, 300]);
    }

    [Check("joining-parts-ask-the-parts-they-hold")]
    static void JoiningPartsAskThePartsTheyHold()
    {
        Try(new Plus(new WallWidth("north"), new WallWidth("east")), "Plus(WallWidth(\"north\"), WallWidth(\"east\"))", [700, 360, 0]);
        Try(new Times(new RoomHeight(), new Length(2)), "Times(RoomHeight(), Length(2))", [560, 480, 600]);
        Try(new DividedRoundUp(new WallWidth("north"), 53), "DividedRoundUp(WallWidth(\"north\"), 53)", [8, 7, 0]);
        Try(new DividedRoundUp(new Length(400), 100), "DividedRoundUp(Length(400), 100)", [4, 4, 4]);
    }

    [Check("nested-estimates-fit-every-room")]
    static void NestedEstimatesFitEveryRoom()
    {
        var strips = new DividedRoundUp(new Plus(new WallWidth("north"), new Plus(new WallWidth("east"), new WallWidth("south"))), 53);
        const string stripsWritten = "DividedRoundUp(Plus(WallWidth(\"north\"), Plus(WallWidth(\"east\"), WallWidth(\"south\"))), 53)";
        Try(strips, stripsWritten, [14, 13, 0]);
        Try(new DividedRoundUp(new Times(strips, new Plus(new RoomHeight(), new Length(10))), 1000),
            $"DividedRoundUp(Times({stripsWritten}, Plus(RoomHeight(), Length(10))), 1000)", [5, 4, 0]);
        Try(new Plus(new Times(new RoomHeight(), new DividedRoundUp(new WallWidth("west"), 100)), new Length(5)),
            "Plus(Times(RoomHeight(), DividedRoundUp(WallWidth(\"west\"), 100)), Length(5))", [5, 485, 5]);
    }

    [Check("each-part-measures-itself")]
    static void EachPartMeasuresItself()
    {
        var parts = new[] { typeof(Length), typeof(WallWidth), typeof(RoomHeight), typeof(Plus), typeof(Times), typeof(DividedRoundUp) };
        foreach (var type in parts)
            Expect.That(WorksItOut(type, typeof(Measure), "Amount"), "notItsOwnAmount", new { type = type.Name });

        var test = TypeTest(parts.Select(t => t.Name).ToArray());
        Expect.That(test is null, "typeTest", new { code = test });
    }

    // The class works out its own answer: the method is written in the class, or in a class of its own between it and the base.
    static bool WorksItOut(Type type, Type @base, string method)
    {
        if (!@base.IsAssignableFrom(type)) return false;
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType != @base && found.DeclaringType != typeof(object);
    }

    // The first piece of code that tests whether something is one of the named classes; null when there is none.
    static string? TypeTest(string[] names)
    {
        static string Name(SyntaxNode? n) => n switch
        {
            QualifiedNameSyntax q => q.Right.Identifier.ValueText,
            SimpleNameSyntax s => s.Identifier.ValueText,
            _ => "",
        };

        foreach (var node in Source.Root.DescendantNodes())
        {
            SyntaxNode? named = node switch
            {
                BinaryExpressionSyntax b when b.OperatorToken.ValueText is "is" or "as" => b.Right,
                DeclarationPatternSyntax d => d.Type,
                RecursivePatternSyntax r => r.Type,
                TypePatternSyntax t => t.Type,
                ConstantPatternSyntax c => c.Expression,
                CaseSwitchLabelSyntax c => c.Value,
                TypeOfExpressionSyntax t => t.Type,
                _ => null,
            };
            if (named is not null && names.Contains(Name(named))) return node.ToString();
        }
        return null;
    }
}
