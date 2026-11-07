foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var lines = new List<string>();
        var article = new Article();
        void Say(string action, string answer) => lines.Add($"{action}: {answer} [{article.Status}]");
        Say("approve", article.Approve());
        Say("submit", article.Submit());
        Say("reject", article.Reject());
        Say("submit", article.Submit());
        Say("approve", article.Approve());
        Say("reject", article.Reject());
        Say("submit", article.Submit());
        return lines;
    }
}

// One method for each action. The states hold nothing, so every article shares one instance of each.
public abstract class ArticleState
{
    public abstract string Name { get; }
    public abstract string Submit(Article article);
    public abstract string Approve(Article article);
    public abstract string Reject(Article article);
}

// An article for the school newspaper. It holds its current state and passes every action on to it.
public class Article
{
    private ArticleState state = Draft.Instance;

    public string Status => state.Name;

    public void SetState(ArticleState next) => state = next;

    public string Submit() => state.Submit(this);
    public string Approve() => state.Approve(this);
    public string Reject() => state.Reject(this);
}

public sealed class Draft : ArticleState
{
    public static readonly Draft Instance = new();

    public override string Name => "draft";

    public override string Submit(Article article)
    {
        article.SetState(WithEditor.Instance);
        return "sent to the editor";
    }

    public override string Approve(Article article) => "submit it first";
    public override string Reject(Article article) => "submit it first";
}

public sealed class WithEditor : ArticleState
{
    public static readonly WithEditor Instance = new();

    public override string Name => "with the editor";

    public override string Submit(Article article) => "already with the editor";

    public override string Approve(Article article)
    {
        article.SetState(GoingToPrint.Instance);
        return "in the next issue";
    }

    public override string Reject(Article article)
    {
        article.SetState(Draft.Instance);
        return "sent back to the writer";
    }
}

public sealed class GoingToPrint : ArticleState
{
    public static readonly GoingToPrint Instance = new();

    public override string Name => "going to print";

    public override string Submit(Article article) => "already going to print";
    public override string Approve(Article article) => "already going to print";
    public override string Reject(Article article) => "already going to print";
}
