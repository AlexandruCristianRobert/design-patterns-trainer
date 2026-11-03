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
        ExpectOwnWork(typeof(Measure), parts, "Amount");

        var test = TypeTest(parts.Select(t => t.Name).ToArray());
        Expect.That(test is null, "typeTest", new { code = test });
    }

    // ---- Each part has its own method ----

    // Each part is a base type with its own method. The base has no code, and the only other classes of the base type
    // are abstract classes in between, with no code either. Fields and properties do not count as code.
    static void ExpectOwnWork(Type @base, Type[] parts, string method)
    {
        foreach (var type in parts)
        {
            Expect.That(@base.IsAssignableFrom(type), "notAPart", new { type = type.Name });
            Expect.That(Declares(type, @base, method), "notItsOwn", new { type = type.Name });
        }

        var code = CodeIn(@base);
        Expect.That(code is null, "baseHasCode", new { member = code });

        foreach (var extra in CheckContext.Current.Assembly.GetTypes().Where(t =>
                     t != @base && @base.IsAssignableFrom(t) && !parts.Contains(t) && !t.Name.Contains('<')
                     && !t.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute))))
        {
            Expect.That(extra.IsAbstract, "extraPart", new { type = extra.Name });
            var inBetween = CodeIn(extra);
            Expect.That(inBetween is null, "betweenHasCode", new { type = extra.Name, member = inBetween });
        }
    }

    // The first method the type itself writes with a body, not counting property accessors; null when there is none.
    static string? CodeIn(Type type) =>
        type.GetMethods(BindingFlags.DeclaredOnly | BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(m => !m.IsAbstract && !m.IsSpecialName && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)))
            ?.Name;

    // The method is written in the class itself.
    static bool Declares(Type type, Type @base, string method)
    {
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType == type;
    }

    static string CalledName(InvocationExpressionSyntax call) => call.Expression switch
    {
        MemberAccessExpressionSyntax m => m.Name.Identifier.ValueText,
        MemberBindingExpressionSyntax b => b.Name.Identifier.ValueText,
        SimpleNameSyntax s => s.Identifier.ValueText,
        _ => "",
    };

    // The first piece of code that tests which class something is: is, as, a type pattern, typeof or nameof on one
    // of the named classes, or GetType() inside one of them; null when there is none.
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
            if (node is InvocationExpressionSyntax call)
            {
                if (CalledName(call) == "GetType" && call.ArgumentList.Arguments.Count == 0
                    && call.Ancestors().OfType<TypeDeclarationSyntax>().Any(d => names.Contains(d.Identifier.ValueText))) return call.ToString();
                if (call.Expression is IdentifierNameSyntax { Identifier.ValueText: "nameof" }
                    && call.ArgumentList.Arguments.Any(a => names.Contains(Name(a.Expression)))) return call.ToString();
                continue;
            }
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
