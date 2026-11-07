foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var inbox = new SupportInbox();
        return
        [
            inbox.Route("Please refund order 1182"),
            inbox.Route("I forgot my password"),
            inbox.Route("My kettle arrived broken"),
            inbox.Route("A refund for a broken kettle"),
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
}

public class BillingTeam(SupportTeam? next = null) : SupportTeam(next)
{
    public override string Take(string subject) =>
        subject.Contains("refund") ? $"Billing team: {subject}" : Pass(subject);
}

public class AccountTeam(SupportTeam? next = null) : SupportTeam(next)
{
    public override string Take(string subject) =>
        subject.Contains("password") ? $"Account team: {subject}" : Pass(subject);
}

public class RepairsTeam(SupportTeam? next = null) : SupportTeam(next)
{
    public override string Take(string subject) =>
        subject.Contains("broken") ? $"Repairs team: {subject}" : Pass(subject);
}

// The inbox puts the teams in line once, and then only hands each email to the first team.
public class SupportInbox
{
    private readonly SupportTeam first = new BillingTeam(new AccountTeam(new RepairsTeam()));

    public string Route(string subject) => first.Take(subject);
}
