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

// Every kind of income carries the rules of every part of the tax return.
// A new part of the return means a new method in every income class.
public interface IIncome
{
    int Taxable();
    string Line();
}

public class Salary(int amount) : IIncome
{
    public int Amount { get; } = amount;

    public int Taxable() => Amount;
    public string Line() => $"salary: {Amount} EUR";
}

public class Rent(int amount, int costs) : IIncome
{
    public int Amount { get; } = amount;
    public int Costs { get; } = costs;

    public int Taxable() => Amount - Costs;
    public string Line() => $"rent: {Amount} EUR, costs {Costs} EUR";
}

public class TaxReturn(List<IIncome> incomes)
{
    public int TaxableIncome() => incomes.Sum(income => income.Taxable());

    public List<string> Lines() => incomes.Select(income => income.Line()).ToList();
}
