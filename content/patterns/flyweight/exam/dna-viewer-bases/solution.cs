var styles = new BaseStyles();
var strand = new Strand(styles, "GATTACAgattaca");

Console.WriteLine(strand.Paint(0, 7));
Console.WriteLine($"Same style for G and g: {ReferenceEquals(strand.StyleAt(0), strand.StyleAt(7))}");
Console.WriteLine($"Styles created: {styles.Created}");

// How every letter of one base is shown. It never changes, so every position with that base shares it.
public sealed class BaseStyle(char letter, string name, string colour)
{
    public char Letter { get; } = letter;
    public string Name { get; } = name;
    public string Colour { get; } = colour;
}

// Hands out one BaseStyle per base, and creates it only the first time that base is asked for.
// A lowercase letter means the same base as its uppercase one.
public class BaseStyles
{
    private readonly BaseStyle?[] made = new BaseStyle?[4];

    public int Created => made.Count(s => s is not null);

    public BaseStyle Get(char letter) => char.ToUpperInvariant(letter) switch
    {
        'A' => made[0] ??= new BaseStyle('A', "adenine", "green"),
        'C' => made[1] ??= new BaseStyle('C', "cytosine", "blue"),
        'G' => made[2] ??= new BaseStyle('G', "guanine", "yellow"),
        'T' => made[3] ??= new BaseStyle('T', "thymine", "red"),
        _ => throw new ArgumentException($"{letter} is not a base."),
    };
}

// A strand keeps only one reference per position, to the shared style of the base there.
public class Strand
{
    private readonly BaseStyle[] positions;

    public Strand(BaseStyles styles, string letters) => positions = letters.Select(styles.Get).ToArray();

    public BaseStyle StyleAt(int position) => positions[position];

    public string Paint(int start, int length) =>
        string.Join(" ", positions.Skip(start).Take(length).Select(s => $"{s.Letter}:{s.Colour}"));
}
