foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var taxReturn = new TaxReturn([new Salary(30000), new Rent(9000, 2000), new Salary(4000)]);
        var lines = taxReturn.Lines();
        lines.Add($"taxable income: {taxReturn.TaxableIncome()} EUR");
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

public class TaxableTotal : IIncomeVisitor
{
    public int Total { get; private set; }

    public void Visit(Salary salary) => Total += salary.Amount;
    public void Visit(Rent rent) => Total += rent.Amount - rent.Costs;
}

public class IncomeLines : IIncomeVisitor
{
    public List<string> Lines { get; } = new();

    public void Visit(Salary salary) => Lines.Add($"salary: {salary.Amount} EUR");
    public void Visit(Rent rent) => Lines.Add($"rent: {rent.Amount} EUR, costs {rent.Costs} EUR");
}

public class TaxReturn(List<IIncome> incomes)
{
    public int TaxableIncome()
    {
        var total = new TaxableTotal();
        foreach (var income in incomes) income.Accept(total);
        return total.Total;
    }

    public List<string> Lines()
    {
        var lines = new IncomeLines();
        foreach (var income in incomes) income.Accept(lines);
        return lines.Lines;
    }
}
