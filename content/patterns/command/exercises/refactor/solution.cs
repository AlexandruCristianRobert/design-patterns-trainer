foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var room = new StockRoom();
        var desk = new StockDesk(room);
        var lines = new List<string>();
        desk.Receive("bolts", 40);
        lines.Add($"receive 40 bolts: {room}");
        desk.Receive("hinges", 12);
        lines.Add($"receive 12 hinges: {room}");
        desk.Ship("bolts", 15);
        lines.Add($"ship 15 bolts: {room}");
        desk.Undo();
        lines.Add($"undo: {room}");
        return lines;
    }
}

// What is on the shelves of a hardware shop's stock room. Leave as is.
public class StockRoom
{
    private readonly SortedDictionary<string, int> counts = [];

    public int Count(string item) => counts.GetValueOrDefault(item);
    public void Add(string item, int amount) => counts[item] = Count(item) + amount;
    public void Remove(string item, int amount) => counts[item] = Count(item) - amount;

    // The items in A to Z order, such as "bolts 25, hinges 12".
    public override string ToString() => string.Join(", ", counts.Select(c => $"{c.Key} {c.Value}"));
}

// Every change to the stock room is an object that can do itself and undo itself.
public interface StockMove
{
    void Do();
    void Undo();
}

public class ReceiveGoods(StockRoom room, string item, int amount) : StockMove
{
    public void Do() => room.Add(item, amount);
    public void Undo() => room.Remove(item, amount);
}

public class ShipGoods(StockRoom room, string item, int amount) : StockMove
{
    public void Do() => room.Remove(item, amount);
    public void Undo() => room.Add(item, amount);
}

// Runs moves and keeps them. It knows only StockMove, never which kind of move it holds.
public class MoveLog
{
    private readonly Stack<StockMove> done = new();

    public void Run(StockMove move)
    {
        move.Do();
        done.Push(move);
    }

    public void Undo()
    {
        if (done.TryPop(out var move)) move.Undo();
    }
}

// The desk turns each change into a move and hands it to its log.
public class StockDesk(StockRoom room)
{
    private readonly MoveLog log = new();

    public void Receive(string item, int amount) => log.Run(new ReceiveGoods(room, item, amount));
    public void Ship(string item, int amount) => log.Run(new ShipGoods(room, item, amount));
    public void Undo() => log.Undo();
}
