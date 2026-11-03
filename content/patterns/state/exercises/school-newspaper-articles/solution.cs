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
        Say("withdraw", article.Withdraw());
        Say("submit", article.Submit());
        Say("approve", article.Approve());
        Say("reject", article.Reject());
        Say("withdraw", article.Withdraw());

        article = new Article();
        for (var round = 0; round < 3; round++)
        {
            Say("submit", article.Submit());
            Say("reject", article.Reject());
        }
        Say("submit", article.Submit());
        return lines;
    }
}

// One method for each action. The states here hold nothing, so every article shares one instance of each.
public abstract class ArticleState
{
    public abstract string Name { get; }
    public abstract string Submit(Article article);
    public abstract string Approve(Article article);
    public abstract string Reject(Article article);
    public abstract string Withdraw(Article article);
}

// An article for the school newspaper. It keeps the number of rejections and its current state,
// and passes every action on to the state.
public class Article
{
    private ArticleState state = Draft.Instance;

    public int Rejections { get; private set; }

    public string Status => state.Name;

    public void SetState(ArticleState next) => state = next;
    public void CountRejection() => Rejections++;

    public string Submit() => state.Submit(this);
    public string Approve() => state.Approve(this);
    public string Reject() => state.Reject(this);
    public string Withdraw() => state.Withdraw(this);
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
    public override string Withdraw(Article article) => "already a draft";
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
        article.CountRejection();
        if (article.Rejections < 3)
        {
            article.SetState(Draft.Instance);
            return $"sent back to the writer ({article.Rejections} of 3)";
        }
        article.SetState(Dropped.Instance);
        return "dropped after 3 rejections";
    }

    public override string Withdraw(Article article)
    {
        article.SetState(Draft.Instance);
        return "back to draft";
    }
}

public sealed class GoingToPrint : ArticleState
{
    public static readonly GoingToPrint Instance = new();

    public override string Name => "going to print";

    public override string Submit(Article article) => "already going to print";
    public override string Approve(Article article) => "already going to print";
    public override string Reject(Article article) => "already going to print";
    public override string Withdraw(Article article) => "too late, it is going to print";
}

public sealed class Dropped : ArticleState
{
    public static readonly Dropped Instance = new();

    public override string Name => "dropped";

    public override string Submit(Article article) => "dropped, write a new article";
    public override string Approve(Article article) => "dropped, write a new article";
    public override string Reject(Article article) => "dropped, write a new article";
    public override string Withdraw(Article article) => "dropped, write a new article";
}
