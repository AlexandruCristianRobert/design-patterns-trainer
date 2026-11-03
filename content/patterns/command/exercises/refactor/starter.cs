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
        desk.Ship("bolts", 15);
        lines.Add($"ship 15 bolts: {room}");
        desk.Receive("hinges", 12);
        lines.Add($"receive 12 hinges: {room}");
        desk.Recount("bolts", 22);
        lines.Add($"recount bolts as 22: {room}");
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
    public void SetCount(string item, int count) => counts[item] = count;

    // The items in stock in A to Z order, such as "bolts 25, hinges 12", or "empty".
    public override string ToString()
    {
        var inStock = counts.Where(c => c.Value != 0).Select(c => $"{c.Key} {c.Value}").ToList();
        return inStock.Count == 0 ? "empty" : string.Join(", ", inStock);
    }
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

    public void Recount(string item, int counted)
    {
        lastAmount = room.Count(item);
        room.SetCount(item, counted);
        lastChange = "recount";
        lastItem = item;
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
            case "recount":
                room.SetCount(lastItem, lastAmount);
                break;
        }
        lastChange = "";
    }
}
