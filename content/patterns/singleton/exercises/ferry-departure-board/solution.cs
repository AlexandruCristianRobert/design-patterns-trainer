var office = DepartureBoard.Instance;
office.Post("Island ferry", "09:15");
office.Post("Harbour shuttle", "09:40");

var pier = DepartureBoard.Instance;
Console.WriteLine(pier.Show("Island ferry"));
Console.WriteLine(pier.Show("Harbour shuttle"));
Console.WriteLine(pier.Show("Night boat"));

public sealed class DepartureBoard
{
    private static readonly Lazy<DepartureBoard> board = new(() => new DepartureBoard());

    public static DepartureBoard Instance => board.Value;

    private readonly Dictionary<string, string> times = [];

    private DepartureBoard() { }

    public void Post(string route, string time) => times[route] = time;

    public string Show(string route) =>
        times.TryGetValue(route, out var time) ? $"{route}: {time}" : $"{route}: no departure";
}
