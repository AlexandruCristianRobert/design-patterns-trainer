using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class MeetingRoomChecks
{
    // A reception desk with a new line of free rooms.
    static Reception Desk() => new(OfficeFloor.Rooms());

    [Check("smallest-room-that-fits")]
    static void SmallestRoomThatFits()
    {
        var two = Desk().Request(2);
        Expect.That(two == "Booth booked for 2", "wrongRoom", new { people = 2, expected = "Booth booked for 2", actual = two });

        var three = Desk().Request(3);
        Expect.That(three == "Small room booked for 3", "wrongRoom", new { people = 3, expected = "Small room booked for 3", actual = three });

        var six = Desk().Request(6);
        Expect.That(six == "Small room booked for 6", "wrongRoom", new { people = 6, expected = "Small room booked for 6", actual = six });

        var seven = Desk().Request(7);
        Expect.That(seven == "Hall booked for 7", "wrongRoom", new { people = 7, expected = "Hall booked for 7", actual = seven });

        var twenty = Desk().Request(20);
        Expect.That(twenty == "Hall booked for 20", "wrongRoom", new { people = 20, expected = "Hall booked for 20", actual = twenty });
    }

    [Check("booked-rooms-send-it-on")]
    static void BookedRoomsSendItOn()
    {
        var desk = Desk();
        var answers = string.Join(" / ", desk.Request(2), desk.Request(2), desk.Request(1), desk.Request(1));
        const string expected = "Booth booked for 2 / Small room booked for 2 / Hall booked for 1 / No room free for 1";
        Expect.That(answers == expected, "wrongSequence", new { expected, actual = answers });
    }

    [Check("too-many-people-books-nothing")]
    static void TooManyPeopleBooksNothing()
    {
        var desk = Desk();
        var crowd = desk.Request(25);
        Expect.That(crowd == "No room free for 25", "wrongTooMany", new { expected = "No room free for 25", actual = crowd });

        var after = string.Join(" / ", desk.Request(2), desk.Request(5), desk.Request(15));
        const string expected = "Booth booked for 2 / Small room booked for 5 / Hall booked for 15";
        Expect.That(after == expected, "refusalBookedSomething", new { expected, actual = after });
    }

    [Check("each-line-starts-free")]
    static void EachLineStartsFree()
    {
        var first = Desk();
        first.Request(2);
        first.Request(4);
        var second = Desk().Request(2);
        Expect.That(second == "Booth booked for 2", "sharedRooms", new { expected = "Booth booked for 2", actual = second });
    }

    [Check("rooms-know-only-the-next")]
    static void RoomsKnowOnlyTheNext()
    {
        var link = typeof(Room);
        foreach (var type in new[] { typeof(Booth), typeof(SmallRoom), typeof(Hall) })
        {
            Expect.That(link.IsAssignableFrom(type), "notARoom", new { type = type.Name });
            Expect.That(FieldsOf(type).Any(f => !f.IsStatic && HoldsOne(f.FieldType, link)), "noNext", new { type = type.Name });
        }

        var held = FieldsOf(typeof(Reception)).Count(f => HoldsOne(f.FieldType, link));
        Expect.That(held == 1, "receptionHoldsMore", new { held });

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "Reception"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .FirstOrDefault(n => n.Identifier.ValueText is "Booth" or "SmallRoom" or "Hall");
            Expect.That(named is null, "receptionNamesRoom", new { room = named?.Identifier.ValueText });
        }

        foreach (var type in link.Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField))
                Expect.That(!HoldsMany(field.FieldType, link), "keptInACollection", new { type = type.Name, field = field.Name });

        var written = CollectionInSource(["Room", "Booth", "SmallRoom", "Hall"]);
        Expect.That(written is null, "collectionInCode", new { written });

        var loop = LoopCalling("Book");
        Expect.That(loop is null, "loopCallsEach", new { loop });
    }

    // ---- Who holds which link ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every field of a type: its own and the ones it inherits, private ones included.
    static IEnumerable<FieldInfo> FieldsOf(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var field in t.GetFields(AnyField))
                yield return field;
    }

    // A field of this type can hold one link.
    static bool HoldsOne(Type fieldType, Type link) => fieldType != typeof(object) && fieldType.IsAssignableFrom(link);

    // A field of this type holds many links: an array or a collection of them.
    static bool HoldsMany(Type fieldType, Type link)
    {
        bool IsLink(Type t) => t != typeof(object) && (t.IsAssignableFrom(link) || link.IsAssignableFrom(t));
        if (fieldType.IsArray) return IsLink(fieldType.GetElementType()!);
        return fieldType.GetInterfaces().Append(fieldType)
            .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>))
            .Any(i => IsLink(i.GetGenericArguments()[0]));
    }

    // The first type written in the code that collects links, such as List<Room> or Room[]; null when there is none.
    static string? CollectionInSource(string[] names)
    {
        bool Mentions(SyntaxNode node) =>
            node.DescendantNodesAndSelf().OfType<IdentifierNameSyntax>().Any(n => names.Contains(n.Identifier.ValueText));
        foreach (var node in Source.Root.DescendantNodes())
        {
            if (node is GenericNameSyntax generic && generic.TypeArgumentList.Arguments.Any(Mentions)) return generic.ToString();
            if (node is ArrayTypeSyntax array && Mentions(array.ElementType)) return array.ToString();
        }
        return null;
    }

    // The first loop or lambda inside a class that calls the given method, such as a foreach over the links; null when there is none.
    static string? LoopCalling(string method)
    {
        bool Calls(SyntaxNode node) => node.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(i =>
            i.Expression is MemberAccessExpressionSyntax access && access.Name.Identifier.ValueText == method
            || i.Expression is MemberBindingExpressionSyntax binding && binding.Name.Identifier.ValueText == method);
        var loop = Source.Root.DescendantNodes().Where(n => n.Ancestors().OfType<TypeDeclarationSyntax>().Any()).FirstOrDefault(n =>
            n is ForEachStatementSyntax or ForStatementSyntax or WhileStatementSyntax or DoStatementSyntax or LambdaExpressionSyntax && Calls(n));
        return loop?.ToString().Split('\n')[0].Trim();
    }
}
