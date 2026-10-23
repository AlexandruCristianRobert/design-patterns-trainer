var sport = new HeadlineDesk(HouseStyles.Upper);
var business = new HeadlineDesk(HouseStyles.TitleCase);
var culture = new HeadlineDesk(HouseStyles.Sentence);

Console.WriteLine(sport.Format("  late goal   sends Rapid top "));
Console.WriteLine(business.Format("markets OPEN higher after rate cut"));
Console.WriteLine(culture.Format("NEW museum wing opens in Cluj"));

// A style is any function from a tidied headline to the styled one.
public delegate string HeadlineStyle(string headline);

public static class HouseStyles
{
    public static HeadlineStyle Upper { get; } = headline => headline.ToUpperInvariant();

    public static HeadlineStyle TitleCase { get; } = headline =>
        string.Join(" ", headline.Split(' ').Select(Capitalize));

    public static HeadlineStyle Sentence { get; } = Capitalize;

    private static string Capitalize(string text) =>
        text.Length == 0 ? text : char.ToUpperInvariant(text[0]) + text[1..].ToLowerInvariant();
}

public class HeadlineDesk(HeadlineStyle style)
{
    public string Format(string headline)
    {
        // Every desk tidies the spacing the same way; only the casing differs.
        var tidy = string.Join(" ", headline.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        return style(tidy);
    }
}
