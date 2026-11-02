var payroll = new LegacyPayroll(new()
{
    ["202603"] = ["004217Ana Popescu         000350000", "000815Mihai Ionescu       000412550"],
});
var report = new PayrollReport(new PayrollFeed(payroll));

foreach (var slip in new PayrollFeed(payroll).PayslipsFor(2026, 3))
    Console.WriteLine($"{slip.EmployeeId} {slip.Name}: {slip.Gross:0.00}");
Console.WriteLine($"March total: {report.Total(2026, 3):0.00}");
Console.WriteLine($"April total: {report.Total(2026, 4):0.00}");

// One payslip, as the new HR app expects it.
public record Payslip(string EmployeeId, string Name, decimal Gross);

// What the new HR app reads payslips through.
public interface IPayslipFeed
{
    IReadOnlyList<Payslip> PayslipsFor(int year, int month);
}

// Plays the part of the old payroll system: fixed-width text lines per period "yyyyMM".
public sealed class LegacyPayroll(Dictionary<string, List<string>> runs)
{
    public List<string> Extract(string period) => runs.TryGetValue(period, out var lines) ? lines : [];
}

// Lets the HR app read the old payroll: turns a year and month into a period, and each line into a Payslip.
public class PayrollFeed(LegacyPayroll payroll) : IPayslipFeed
{
    public IReadOnlyList<Payslip> PayslipsFor(int year, int month) =>
        payroll.Extract($"{year:D4}{month:D2}")
               .Select(line => new Payslip(line[..6], line[6..26].TrimEnd(), long.Parse(line[26..35]) / 100m))
               .ToList();
}

// Part of the HR app: it only knows IPayslipFeed.
public class PayrollReport(IPayslipFeed feed)
{
    public decimal Total(int year, int month) => feed.PayslipsFor(year, month).Sum(p => p.Gross);
}
