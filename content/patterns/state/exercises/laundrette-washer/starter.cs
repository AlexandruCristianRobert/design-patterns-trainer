foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var washer = new Washer();
        var lines = new List<string>();
        void Say(string button, string answer) => lines.Add($"{button}: {answer} [{washer.Status}, coins {washer.Coins}]");
        Say("start", washer.Start());
        Say("coin", washer.InsertCoin());
        Say("coin", washer.InsertCoin());
        Say("coin", washer.InsertCoin());
        Say("start", washer.Start());
        Say("open door", washer.OpenDoor());
        Say("finish", washer.Finish());
        Say("coin", washer.InsertCoin());
        Say("open door", washer.OpenDoor());
        Say("coin", washer.InsertCoin());
        return lines;
    }
}

// A coin washing machine at a laundrette. A wash costs 2 coins.
// Every button switches on the status, and every new status means changing every button.
public class Washer
{
    private string status = "idle";

    public string Status => status;
    public int Coins { get; private set; }

    public string InsertCoin()
    {
        switch (status)
        {
            case "idle":
                Coins++;
                if (Coins < 2) return $"{Coins} of 2 coins paid";
                status = "paid";
                return "paid, press start";
            case "paid":
                return "already paid, coin returned";
            case "washing":
                return "busy, coin returned";
            default:
                return "take your washing out first, coin returned";
        }
    }

    public string Start()
    {
        switch (status)
        {
            case "idle":
                return $"{Coins} of 2 coins paid";
            case "paid":
                Coins = 0;
                status = "washing";
                return "washing";
            case "washing":
                return "already washing";
            default:
                return "take your washing out first";
        }
    }

    // The machine calls this when the wash is over.
    public string Finish()
    {
        if (status != "washing") return "not washing";
        status = "done";
        return "done, open the door";
    }

    public string OpenDoor()
    {
        switch (status)
        {
            case "washing":
                return "locked while washing";
            case "done":
                status = "idle";
                return "door open";
            default:
                return "door open";
        }
    }
}
