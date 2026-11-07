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

public enum Stage { Draft, WithEditor, GoingToPrint }

// An article for the school newspaper. A student writes it and the editor approves or rejects it.
// Every action switches on the stage.
public class Article
{
    private Stage stage = Stage.Draft;

    public string Status => stage switch
    {
        Stage.Draft => "draft",
        Stage.WithEditor => "with the editor",
        _ => "going to print",
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
            default:
                return "already going to print";
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
            default:
                return "already going to print";
        }
    }

    public string Reject()
    {
        switch (stage)
        {
            case Stage.Draft:
                return "submit it first";
            case Stage.WithEditor:
                stage = Stage.Draft;
                return "sent back to the writer";
            default:
                return "already going to print";
        }
    }
}
