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

public enum Stage { Draft, WithEditor, GoingToPrint, Dropped }

// An article for the school newspaper. A student writes it, the editor approves or rejects it,
// and after three rejections it is dropped. Every action switches on the stage.
public class Article
{
    private Stage stage = Stage.Draft;

    public int Rejections { get; private set; }

    public string Status => stage switch
    {
        Stage.Draft => "draft",
        Stage.WithEditor => "with the editor",
        Stage.GoingToPrint => "going to print",
        _ => "dropped",
    };

    public string Submit()
    {
        switch (stage)
        {
            case Stage.Draft:
                stage = Stage.WithEditor;
                return "sent to the editor";
            case Stage.WithEditor:
                return "already with the editor";
            case Stage.GoingToPrint:
                return "already going to print";
            default:
                return "dropped, write a new article";
        }
    }

    public string Approve()
    {
        switch (stage)
        {
            case Stage.Draft:
                return "submit it first";
            case Stage.WithEditor:
                stage = Stage.GoingToPrint;
                return "in the next issue";
            case Stage.GoingToPrint:
                return "already going to print";
            default:
                return "dropped, write a new article";
        }
    }

    public string Reject()
    {
        switch (stage)
        {
            case Stage.Draft:
                return "submit it first";
            case Stage.WithEditor:
                Rejections++;
                if (Rejections < 3)
                {
                    stage = Stage.Draft;
                    return $"sent back to the writer ({Rejections} of 3)";
                }
                stage = Stage.Dropped;
                return "dropped after 3 rejections";
            case Stage.GoingToPrint:
                return "already going to print";
            default:
                return "dropped, write a new article";
        }
    }

    public string Withdraw()
    {
        switch (stage)
        {
            case Stage.Draft:
                return "already a draft";
            case Stage.WithEditor:
                stage = Stage.Draft;
                return "back to draft";
            case Stage.GoingToPrint:
                return "too late, it is going to print";
            default:
                return "dropped, write a new article";
        }
    }
}
