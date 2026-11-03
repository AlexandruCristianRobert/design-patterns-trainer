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

// Every kind of income carries the rules of every part of the tax return.
// A new part of the return means a new method in every income class.
public interface IIncome
{
    int Tax();
    string Line();
}

public class Salary(int amount) : IIncome
{
    public int Amount { get; } = amount;

    public int Tax() => Amount / 5;
    public string Line() => $"salary: {Amount} EUR";
}

public class Rent(int amount, int costs) : IIncome
{
    public int Amount { get; } = amount;
    public int Costs { get; } = costs;

    // Only the profit is taxed.
    public int Tax() => (Amount - Costs) / 5;
    public string Line() => $"rent: {Amount} EUR, less {Costs} EUR costs";
}

public class Dividend(int amount) : IIncome
{
    public int Amount { get; } = amount;

    // The first 500 EUR are tax-free.
    public int Tax() => Amount <= 500 ? 0 : (Amount - 500) / 10;
    public string Line() => $"dividend: {Amount} EUR, 500 EUR tax-free";
}

public class TaxReturn(List<IIncome> incomes)
{
    public int TotalTax() => incomes.Sum(income => income.Tax());

    public List<string> Lines() => incomes.Select(income => income.Line()).ToList();
}
