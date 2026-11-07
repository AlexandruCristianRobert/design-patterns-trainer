foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var washer = new Washer();
        var lines = new List<string>();
        void Say(string button, string answer) => lines.Add($"{button}: {answer} [{washer.Status}]");
        Say("start", washer.Start());
        Say("coin", washer.InsertCoin());
        Say("coin", washer.InsertCoin());
        Say("start", washer.Start());
        Say("coin", washer.InsertCoin());
        Say("finish", washer.Finish());
        Say("coin", washer.InsertCoin());
        return lines;
    }
}

// A coin washing machine at a laundrette. One coin pays for a wash.
// Every button switches on the status, and every new status means changing every button.
public class Washer
{
    private string status = "idle";

    public string Status => status;

    public string InsertCoin()
    {
        switch (status)
        {
            case "idle":
                status = "paid";
                return "paid, press start";
            case "paid":
                return "already paid, coin returned";
            default:
                return "busy, coin returned";
        }
    }

    public string Start()
    {
        switch (status)
        {
            case "idle":
                return "insert a coin first";
            case "paid":
                status = "washing";
                return "washing";
            default:
                return "already washing";
        }
    }

    // The machine calls this when the wash is over.
    public string Finish()
    {
        switch (status)
        {
            case "washing":
                status = "idle";
                return "done";
            default:
                return "not washing";
        }
    }
}
