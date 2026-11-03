foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var inbox = new SupportInbox();
        return
        [
            inbox.Route("Refund for order 1182"),
            inbox.Route("Forgot my password"),
            inbox.Route("Kettle arrived broken"),
            inbox.Route("Refund for a broken kettle"),
            inbox.Route("Do you ship to Iceland?"),
        ];
    }
}

// The web shop's support inbox. Every email subject goes down one if/else ladder,
// and the inbox decides by itself which team gets the email.
public class SupportInbox
{
    public string Route(string subject)
    {
        var text = subject.ToLowerInvariant();
        if (text.Contains("refund"))
            return $"Billing team: {subject}";
        else if (text.Contains("password"))
            return $"Account team: {subject}";
        else if (text.Contains("broken"))
            return $"Repairs team: {subject}";
        else
            return $"General inbox: {subject}";
    }
}
