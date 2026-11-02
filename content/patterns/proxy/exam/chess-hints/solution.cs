var panel = new HintPanel(new LimitedAdvisor(2));
Console.WriteLine($"Engines started: {ChessEngine.Started}");
Console.WriteLine(panel.Ask("e4 e5"));
Console.WriteLine(panel.Ask("e4 e5 Nf3 Nc6"));
Console.WriteLine(panel.Ask("e4 e5 Nf3 Nc6 Bb5"));
Console.WriteLine($"Engines started: {ChessEngine.Started}");

public interface IAdvisor
{
    string Suggest(string position);
}

// The real engine. Starting one takes seconds and a lot of memory, so Started counts every start.
public class ChessEngine : IAdvisor
{
    public static int Started { get; private set; }

    public ChessEngine() => Started++;

    public string Suggest(string position) => $"after {position}, play Nf3";
}

// Controls access to one engine: it starts the engine on the first hint it gives,
// and gives no more than the hints allowed.
public class LimitedAdvisor(int hintsAllowed) : IAdvisor
{
    private readonly Lazy<ChessEngine> engine = new(() => new ChessEngine());
    private int hintsGiven;

    public string Suggest(string position)
    {
        if (hintsGiven >= hintsAllowed)
            return "No hints left";

        hintsGiven++;
        return engine.Value.Suggest(position);
    }
}

// The panel on the board. It works with any IAdvisor.
public class HintPanel(IAdvisor advisor)
{
    public string Ask(string position) => $"Hint: {advisor.Suggest(position)}";
}
