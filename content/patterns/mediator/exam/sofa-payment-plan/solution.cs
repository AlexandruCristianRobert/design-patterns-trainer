var plan = new PaymentPlan();
plan.Price.Enter(1200);
Console.WriteLine(plan.Summary.Text);
plan.Monthly.Enter(70);
Console.WriteLine(plan.Summary.Text);
plan.Months.Enter(6);
Console.WriteLine(plan.Summary.Text);

// What every field talks to. A field calls Changed with itself after the customer typed into it.
public interface IPlanForm
{
    void Changed(object field);
}

// Builds the fields, hands each of them itself, and holds every rule about which field follows which.
public class PaymentPlan : IPlanForm
{
    public PriceField Price { get; } = new();
    public MonthsField Months { get; } = new();
    public MonthlyField Monthly { get; } = new();
    public SummaryLine Summary { get; } = new();

    public PaymentPlan()
    {
        Price.Form = this;
        Months.Form = this;
        Monthly.Form = this;
        Show();
    }

    public void Changed(object field)
    {
        if (field == Monthly) Months.Set(Up(Price.Euros, Monthly.Euros));
        Monthly.Set(Up(Price.Euros, Months.Count));
        Show();
    }

    // Divides and rounds up: 1200 / 70 is 18.
    private static int Up(int total, int by) => (total + by - 1) / by;

    private void Show() => Summary.Show($"{Price.Euros} EUR over {Months.Count} months, {Monthly.Euros} EUR a month");
}

public class PriceField
{
    public IPlanForm Form { get; set; } = null!;
    public int Euros { get; private set; }

    public void Enter(int euros)
    {
        Euros = euros;
        Form.Changed(this);
    }
}

public class MonthsField
{
    public IPlanForm Form { get; set; } = null!;
    public int Count { get; private set; } = 12;

    public void Enter(int months)
    {
        Set(months);
        Form.Changed(this);
    }

    // Used by the plan: keeps the count between 1 and 24, without telling anyone.
    public void Set(int months) => Count = Math.Clamp(months, 1, 24);
}

public class MonthlyField
{
    public IPlanForm Form { get; set; } = null!;
    public int Euros { get; private set; }

    public void Enter(int euros)
    {
        Euros = Math.Max(1, euros);
        Form.Changed(this);
    }

    // Used by the plan.
    public void Set(int euros) => Euros = euros;
}

public class SummaryLine
{
    public string Text { get; private set; } = "";

    public void Show(string text) => Text = text;
}
