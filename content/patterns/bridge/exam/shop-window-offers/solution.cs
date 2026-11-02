foreach (var line in new Sale(new LedStrip(), 30).Show())
    Console.WriteLine(line);
foreach (var line in new Countdown(new EPaper(), 5).Show())
    Console.WriteLine(line);

// How a window display shows text: a big headline or a small line.
public abstract class Display
{
    public abstract string Headline(string text);
    public abstract string Small(string text);
}

public class LedStrip : Display
{
    public override string Headline(string text) => $">> {text.ToUpperInvariant()} <<";
    public override string Small(string text) => $"> {text}";
}

public class EPaper : Display
{
    public override string Headline(string text) => $"[{text}]";
    public override string Small(string text) => $"({text})";
}

// An offer holds the display it appears on and decides only what to say.
public abstract class Promotion(Display display)
{
    protected Display Display => display;

    public abstract List<string> Show();
}

public class Sale(Display display, int percent) : Promotion(display)
{
    public override List<string> Show() => [Display.Headline($"{percent}% off"), Display.Small("while stocks last")];
}

public class Countdown(Display display, int days) : Promotion(display)
{
    public override List<string> Show() =>
        [Display.Headline("Opening soon"), Display.Small(days == 1 ? "1 day to go" : $"{days} days to go")];
}
