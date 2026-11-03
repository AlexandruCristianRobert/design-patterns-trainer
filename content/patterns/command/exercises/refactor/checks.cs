using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class StockRoomChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "receive 40 bolts: bolts 40",
            "ship 15 bolts: bolts 25",
            "receive 12 hinges: bolts 25, hinges 12",
            "recount bolts as 22: bolts 22, hinges 12",
            "undo: bolts 25, hinges 12",
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
            var done = room.ToString();
            Expect.That(done == afterDo, "wrongDo",
                new { move = $"{type}(room, \"{item}\", {amount})", expected = afterDo, actual = done });
            Call(move, "Undo");
            var undone = room.ToString();
            Expect.That(undone == start, "wrongUndo",
                new { move = $"{type}(room, \"{item}\", {amount})", expected = start, actual = undone });
        }

        Try("ReceiveGoods", "hinges", 8, "bolts 25, hinges 20");
        Try("ReceiveGoods", "nails", 100, "bolts 25, hinges 12, nails 100");
        Try("ShipGoods", "bolts", 10, "bolts 15, hinges 12");
        Try("RecountGoods", "bolts", 22, "bolts 22, hinges 12");
        Try("RecountGoods", "hinges", 0, "bolts 25");
    }

    [Check("undo-goes-back-one-move-at-a-time")]
    static void UndoGoesBackOneMoveAtATime()
    {
        var room = new StockRoom();
        var desk = new StockDesk(room);
        desk.Receive("bolts", 40);
        desk.Ship("bolts", 15);
        desk.Recount("bolts", 22);
        desk.Receive("hinges", 12);
        desk.Recount("hinges", 10);

        string[] expected = ["bolts 22, hinges 12", "bolts 22", "bolts 25", "bolts 40", "empty", "empty"];
        for (var i = 0; i < expected.Length; i++)
        {
            desk.Undo();
            var now = room.ToString();
            Expect.That(now == expected[i], "wrongUndo", new { undos = i + 1, expected = expected[i], actual = now });
        }
    }

    [Check("the-log-runs-and-undoes-any-move")]
    static void TheLogRunsAndUndoesAnyMove()
    {
        var room = new StockRoom();
        var log = Activator.CreateInstance(Code.Type("MoveLog").Clr)!;
        var move = Code.Type("StockMove").Clr;
        var run = log.GetType().GetMethod("Run", [move]);
        var undo = log.GetType().GetMethod("Undo", Type.EmptyTypes);
        if (run is null || undo is null) Expect.Fail("noLogMethods");

        run.Invoke(log, [Make("ReceiveGoods", room, "washers", 50)]);
        run.Invoke(log, [Make("ShipGoods", room, "washers", 20)]);
        var done = room.ToString();
        Expect.That(done == "washers 30", "wrongLogRun", new { expected = "washers 30", actual = done });

        undo.Invoke(log, []);
        var once = room.ToString();
        Expect.That(once == "washers 50", "wrongLogUndo", new { undos = 1, expected = "washers 50", actual = once });
        undo.Invoke(log, []);
        undo.Invoke(log, []);
        var twice = room.ToString();
        Expect.That(twice == "empty", "wrongLogUndo", new { undos = 3, expected = "empty", actual = twice });
    }

    [Check("the-log-knows-only-stock-moves")]
    static void TheLogKnowsOnlyStockMoves()
    {
        var move = Code.Type("StockMove").Clr;
        string[] kinds = ["ReceiveGoods", "ShipGoods", "RecountGoods"];
        foreach (var name in kinds)
            Expect.That(move.IsAssignableFrom(Code.Type(name).Clr), "notAMove", new { type = name });

        var log = Code.Type("MoveLog").Clr;
        foreach (var field in log.GetFields(AnyField))
            foreach (var name in kinds.Append("StockRoom"))
                Expect.That(!Involves(field.FieldType, Code.Type(name).Clr), "logHoldsConcrete", new { field = field.Name, type = name });

        var named = NameUsedIn("MoveLog", [.. kinds, "StockRoom"]);
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

    // The first of the names written inside the named class; null when there is none.
    static string? NameUsedIn(string type, string[] names) =>
        Declarations(type).SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => names.Contains(n.Identifier.ValueText))?.Identifier.ValueText;
}
