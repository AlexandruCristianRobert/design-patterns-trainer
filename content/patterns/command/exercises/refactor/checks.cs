using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class StockRoomChecks
{
    // The bolts and hinges in the room, such as "bolts 25, hinges 12".
    static string Stock(StockRoom room) => $"bolts {room.Count("bolts")}, hinges {room.Count("hinges")}";

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "receive 40 bolts: bolts 40",
            "receive 12 hinges: bolts 40, hinges 12",
            "ship 15 bolts: bolts 25, hinges 12",
            "undo: bolts 40, hinges 12",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("each-move-does-and-undoes-itself")]
    static void EachMoveDoesAndUndoesItself()
    {
        var room = new StockRoom();
        room.Add("bolts", 25);
        room.Add("hinges", 12);
        const string start = "bolts 25, hinges 12";

        void Try(string type, string item, int amount, string afterDo)
        {
            var move = Make(type, room, item, amount);
            Call(move, "Do");
            var done = Stock(room);
            Expect.That(done == afterDo, "wrongDo",
                new { move = $"{type}(room, \"{item}\", {amount})", expected = afterDo, actual = done });
            Call(move, "Undo");
            var undone = Stock(room);
            Expect.That(undone == start, "wrongUndo",
                new { move = $"{type}(room, \"{item}\", {amount})", expected = start, actual = undone });
        }

        Try("ReceiveGoods", "hinges", 8, "bolts 25, hinges 20");
        Try("ShipGoods", "bolts", 10, "bolts 15, hinges 12");
    }

    [Check("undo-goes-back-one-move-at-a-time")]
    static void UndoGoesBackOneMoveAtATime()
    {
        var room = new StockRoom();
        var desk = new StockDesk(room);
        desk.Receive("bolts", 40);
        desk.Ship("bolts", 15);
        desk.Receive("hinges", 12);
        desk.Ship("hinges", 5);

        string[] expected = ["bolts 25, hinges 12", "bolts 25, hinges 0", "bolts 40, hinges 0", "bolts 0, hinges 0"];
        for (var i = 0; i < expected.Length; i++)
        {
            desk.Undo();
            var now = Stock(room);
            Expect.That(now == expected[i], "wrongUndo", new { undos = i + 1, expected = expected[i], actual = now });
        }
    }

    [Check("the-log-knows-only-stock-moves")]
    static void TheLogKnowsOnlyStockMoves()
    {
        var move = Code.Type("StockMove").Clr;
        string[] kinds = ["ReceiveGoods", "ShipGoods"];
        foreach (var name in kinds)
            Expect.That(move.IsAssignableFrom(Code.Type(name).Clr), "notAMove", new { type = name });

        var log = Code.Type("MoveLog").Clr;
        foreach (var field in log.GetFields(AnyField))
            foreach (var name in kinds.Append("StockRoom"))
                Expect.That(!Involves(field.FieldType, Code.Type(name).Clr), "logHoldsConcrete", new { field = field.Name, type = name });

        var named = Declarations("MoveLog").SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "ReceiveGoods" or "ShipGoods" or "StockRoom")?.Identifier.ValueText;
        Expect.That(named is null, "logNamesConcrete", new { type = named });

        var deskFields = typeof(StockDesk).GetFields(AnyField)
            .Where(f => f.FieldType != typeof(StockRoom) && f.FieldType != log).Select(f => f.Name).ToList();
        Expect.That(deskFields.Count == 0, "deskRemembers", new { fields = string.Join(", ", deskFields) });

        foreach (var declaration in Declarations("StockDesk"))
            Expect.That(!declaration.DescendantNodes().Any(n => n is SwitchStatementSyntax or SwitchExpressionSyntax or IfStatementSyntax),
                "deskStillDecides");
    }

    // ---- Making and calling the moves ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A new move of the named type, made with its public constructor (StockRoom room, string item, int amount).
    static object Make(string type, StockRoom room, string item, int amount)
    {
        var ctor = Code.Type(type).Clr.GetConstructor([typeof(StockRoom), typeof(string), typeof(int)]);
        if (ctor is null) Expect.Fail("noConstructor", new { type });
        return ctor.Invoke([room, item, amount]);
    }

    // Calls Do or Undo on a move, through StockMove.
    static void Call(object move, string method)
    {
        var call = Code.Type("StockMove").Clr.GetMethod(method, Type.EmptyTypes);
        if (call is null) Expect.Fail("noMoveMethod", new { method });
        call.Invoke(move, []);
    }

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));

    static IEnumerable<TypeDeclarationSyntax> Declarations(string name) =>
        Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == name);
}
