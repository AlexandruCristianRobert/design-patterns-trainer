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

// The desk where the stock room's changes are typed in. It remembers the last change in loose fields,
// and Undo is a switch that knows every kind of change. It can undo one change and no more.
public class StockDesk(StockRoom room)
{
    private string lastChange = "";
    private string lastItem = "";
    private int lastAmount;

    public void Receive(string item, int amount)
    {
        room.Add(item, amount);
        lastChange = "receive";
        lastItem = item;
        lastAmount = amount;
    }

    public void Ship(string item, int amount)
    {
        room.Remove(item, amount);
        lastChange = "ship";
        lastItem = item;
        lastAmount = amount;
    }

    public void Undo()
    {
        switch (lastChange)
        {
            case "receive":
                room.Remove(lastItem, lastAmount);
                break;
            case "ship":
                room.Add(lastItem, lastAmount);
                break;
        }
        lastChange = "";
    }
}
