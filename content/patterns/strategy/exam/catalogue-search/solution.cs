var catalogue = new Catalogue(["Dune", "Dune Messiah", "Emma", "dune: a guide"]);

catalogue.UseMatch(new ExactMatch());
Console.WriteLine($"exact 'Dune': {string.Join(" | ", catalogue.Find("Dune"))}");

catalogue.UseMatch(new StartsWithMatch());
Console.WriteLine($"starts with 'dune': {string.Join(" | ", catalogue.Find("dune"))}");

public abstract class TitleMatch
{
    public abstract bool Matches(string title, string query);
}

public class Catalogue(List<string> titles)
{
    private readonly List<string> _titles = [.. titles];
    private TitleMatch? _match;

    // The librarian chooses how titles are matched, and can choose again at any time.
    public void UseMatch(TitleMatch match) => _match = match;

    public List<string> Find(string query)
    {
        var match = _match ?? throw new InvalidOperationException("Choose a matching rule before searching.");
        return [.. _titles.Where(title => match.Matches(title, query))];
    }
}

public class ExactMatch : TitleMatch
{
    public override bool Matches(string title, string query) => title == query;
}

public class IgnoreCaseMatch : TitleMatch
{
    public override bool Matches(string title, string query) => string.Equals(title, query, StringComparison.OrdinalIgnoreCase);
}

public class StartsWithMatch : TitleMatch
{
    public override bool Matches(string title, string query) => title.StartsWith(query, StringComparison.OrdinalIgnoreCase);
}
