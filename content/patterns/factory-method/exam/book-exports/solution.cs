List<string> chapters = ["The harbour", "Night train", "Home"];

foreach (var export in new BookExport[] { new PrintExport(), new LargePrintExport(), new EbookExport() })
    Console.WriteLine(export.Export(chapters));

public interface ILayout
{
    // The table of contents entry for one chapter.
    string Chapter(int number, string title);

    // The last line of the table of contents.
    string Footer(int chapters);
}

public class PageLayout : ILayout
{
    public string Chapter(int number, string title) => $"Chapter {number}: {title}, page {(number - 1) * 10 + 1}";
    public string Footer(int chapters) => $"{chapters * 10} pages";
}

public class LargePageLayout : ILayout
{
    public string Chapter(int number, string title) => $"Chapter {number}: {title}, page {(number - 1) * 20 + 1}";
    public string Footer(int chapters) => $"{chapters * 20} pages, large print";
}

public class FlowLayout : ILayout
{
    public string Chapter(int number, string title) => $"{number}. {title}";
    public string Footer(int chapters) => $"{chapters} chapters, reflowable";
}

public abstract class BookExport
{
    // Each kind of export decides how its pages are laid out.
    protected abstract ILayout NewLayout();

    public string Export(List<string> chapters)
    {
        var layout = NewLayout();
        var lines = chapters.Select((title, i) => layout.Chapter(i + 1, title)).ToList();
        lines.Add(layout.Footer(chapters.Count));
        return string.Join(" / ", lines);
    }
}

public class PrintExport : BookExport
{
    protected override ILayout NewLayout() => new PageLayout();
}

// Large print is a print edition with bigger pages.
public class LargePrintExport : PrintExport
{
    protected override ILayout NewLayout() => new LargePageLayout();
}

public class EbookExport : BookExport
{
    protected override ILayout NewLayout() => new FlowLayout();
}
