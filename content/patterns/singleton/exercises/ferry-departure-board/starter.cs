var office = DepartureBoard.Instance;
office.Post("Island ferry", "09:15");
office.Post("Harbour shuttle", "09:40");

var pier = DepartureBoard.Instance;
Console.WriteLine(pier.Show("Island ferry"));
Console.WriteLine(pier.Show("Harbour shuttle"));
Console.WriteLine(pier.Show("Night boat"));

public sealed class DepartureBoard
{
    // TODO: return the terminal's one board, the same object on every read.
    // Two screens may read this at the same moment, so create the board in a thread-safe way.
    public static DepartureBoard Instance => throw new NotImplementedException();

    private readonly Dictionary<string, string> times = [];

    // TODO: no code outside this class may build a board of its own.
    public DepartureBoard() { }

    public void Post(string route, string time) => times[route] = time;

    // TODO: "Island ferry: 09:15", or "Night boat: no departure" for a route nobody posted.
    public string Show(string route) => "";
}
