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

// Every team that can take an email. Each one is created with the team after it, or with none.
public abstract class SupportTeam(SupportTeam? next)
{
    public abstract string Take(string subject);

    // Hands the email to the next team. When no team is next, it lands in the general inbox.
    protected string Pass(string subject) => next?.Take(subject) ?? $"General inbox: {subject}";

    protected static bool Mentions(string subject, string word) =>
        subject.Contains(word, StringComparison.OrdinalIgnoreCase);
}

public class BillingTeam(SupportTeam? next = null) : SupportTeam(next)
{
    public override string Take(string subject) =>
        Mentions(subject, "refund") ? $"Billing team: {subject}" : Pass(subject);
}

public class AccountTeam(SupportTeam? next = null) : SupportTeam(next)
{
    public override string Take(string subject) =>
        Mentions(subject, "password") ? $"Account team: {subject}" : Pass(subject);
}

public class RepairsTeam(SupportTeam? next = null) : SupportTeam(next)
{
    public override string Take(string subject) =>
        Mentions(subject, "broken") ? $"Repairs team: {subject}" : Pass(subject);
}

// The inbox puts the teams in line once, and then only hands each email to the first team.
public class SupportInbox
{
    private readonly SupportTeam first = new BillingTeam(new AccountTeam(new RepairsTeam()));

    public string Route(string subject) => first.Take(subject);
}
