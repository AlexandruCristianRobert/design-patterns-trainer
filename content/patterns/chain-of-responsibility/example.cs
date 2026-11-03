// An expense claim goes to the first approver, and travels up the chain until someone approves it.
var teamLead = new TeamLead();
teamLead.SetNext(new DepartmentHead()).SetNext(new FinanceDirector());
var form = new ExpenseForm(teamLead);

foreach (var amount in new[] { 60m, 800m, 4000m, 25000m })
    Console.WriteLine(form.Submit(amount));

public abstract class Approver
{
    private Approver? next;

    public Approver SetNext(Approver approver)
    {
        next = approver;
        return approver;
    }

    public abstract string Handle(decimal amount);

    // Pass the claim on. At the end of the chain there is a default answer.
    protected string Pass(decimal amount) =>
        next?.Handle(amount) ?? $"{amount} EUR is refused: nobody can approve it";
}

public class TeamLead : Approver
{
    public override string Handle(decimal amount) =>
        amount <= 100 ? $"{amount} EUR is approved by the team lead" : Pass(amount);
}

public class DepartmentHead : Approver
{
    public override string Handle(decimal amount) =>
        amount <= 1000 ? $"{amount} EUR is approved by the department head" : Pass(amount);
}

public class FinanceDirector : Approver
{
    public override string Handle(decimal amount) =>
        amount <= 10000 ? $"{amount} EUR is approved by the finance director" : Pass(amount);
}

public class ExpenseForm(Approver first)
{
    public string Submit(decimal amount) => first.Handle(amount);
}
