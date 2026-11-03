foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var taxReturn = new TaxReturn([new Salary(30000), new Rent(9000, 2000), new Dividend(1500), new Salary(4000)]);
        var lines = taxReturn.Lines();
        lines.Add($"tax to pay: {taxReturn.TotalTax()} EUR");
        return lines;
    }
}

// An income only hands itself to a visitor. Each part of the tax return is a visitor of its own.
public interface IIncome
{
    void Accept(IIncomeVisitor visitor);
}

public interface IIncomeVisitor
{
    void Visit(Salary salary);
    void Visit(Rent rent);
    void Visit(Dividend dividend);
}

public class Salary(int amount) : IIncome
{
    public int Amount { get; } = amount;

    public void Accept(IIncomeVisitor visitor) => visitor.Visit(this);
}

public class Rent(int amount, int costs) : IIncome
{
    public int Amount { get; } = amount;
    public int Costs { get; } = costs;

    public void Accept(IIncomeVisitor visitor) => visitor.Visit(this);
}

public class Dividend(int amount) : IIncome
{
    public int Amount { get; } = amount;

    public void Accept(IIncomeVisitor visitor) => visitor.Visit(this);
}

public class TaxDue : IIncomeVisitor
{
    public int Total { get; private set; }

    public void Visit(Salary salary) => Total += salary.Amount / 5;

    // Only the profit is taxed.
    public void Visit(Rent rent) => Total += (rent.Amount - rent.Costs) / 5;

    // The first 500 EUR are tax-free.
    public void Visit(Dividend dividend) => Total += dividend.Amount <= 500 ? 0 : (dividend.Amount - 500) / 10;
}

public class IncomeLines : IIncomeVisitor
{
    public List<string> Lines { get; } = new();

    public void Visit(Salary salary) => Lines.Add($"salary: {salary.Amount} EUR");
    public void Visit(Rent rent) => Lines.Add($"rent: {rent.Amount} EUR, less {rent.Costs} EUR costs");
    public void Visit(Dividend dividend) => Lines.Add($"dividend: {dividend.Amount} EUR, 500 EUR tax-free");
}

public class TaxReturn(List<IIncome> incomes)
{
    public int TotalTax()
    {
        var tax = new TaxDue();
        foreach (var income in incomes) income.Accept(tax);
        return tax.Total;
    }

    public List<string> Lines()
    {
        var lines = new IncomeLines();
        foreach (var income in incomes) income.Accept(lines);
        return lines.Lines;
    }
}
