using System.Globalization;
using System.Reflection;
using DesignPatterns.Checks;

static class PayrollChecks
{
    // A payslip feed the program has never seen. It records which months it was asked for.
    sealed class TestFeed(params Payslip[] slips) : IPayslipFeed
    {
        public List<string> Asked { get; } = [];

        public IReadOnlyList<Payslip> PayslipsFor(int year, int month)
        {
            Asked.Add($"{year}-{month}");
            return slips;
        }
    }

    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // One line of the old payroll: 6 characters of employee number, the name padded to 20, the gross in cents as 9 digits.
    static string Line(string id, string name, long cents) => $"{id}{name,-20}{cents:D9}";

    static string Show(IEnumerable<Payslip> slips)
    {
        var shown = string.Join(" / ", slips.Select(s => string.Create(CultureInfo.InvariantCulture, $"{s.EmployeeId}|{s.Name}|{s.Gross:0.00}")));
        return shown == "" ? "nothing" : shown;
    }

    [Check("payroll-hands-out-its-runs")]
    static void PayrollHandsOutItsRuns()
    {
        var march = new List<string> { Line("004217", "Ana Popescu", 350000) };
        var payroll = new LegacyPayroll(new() { ["202603"] = march });
        var found = payroll.Extract("202603");
        var missing = payroll.Extract("202604");

        Expect.That(found.SequenceEqual(march), "wrongRun", new { actual = string.Join(" / ", found) });
        Expect.That(missing.Count == 0, "missingRunNotEmpty", new { actual = string.Join(" / ", missing) });
    }

    [Check("months-become-periods")]
    static void MonthsBecomePeriods()
    {
        var payroll = new LegacyPayroll(new()
        {
            ["202603"] = [Line("000001", "March", 100)],
            ["202611"] = [Line("000002", "November", 200)],
            ["199912"] = [Line("000003", "December", 300)],
        });
        IPayslipFeed feed = new PayrollFeed(payroll);
        var march = feed.PayslipsFor(2026, 3).Select(s => s.EmployeeId).FirstOrDefault() ?? "nothing";
        var november = feed.PayslipsFor(2026, 11).Select(s => s.EmployeeId).FirstOrDefault() ?? "nothing";
        var december = feed.PayslipsFor(1999, 12).Select(s => s.EmployeeId).FirstOrDefault() ?? "nothing";
        var january = Show(feed.PayslipsFor(2026, 1));

        Expect.That(march == "000001", "wrongMonth", new { year = 2026, month = 3, period = "202603", actual = march, expected = "000001" });
        Expect.That(november == "000002", "wrongMonth", new { year = 2026, month = 11, period = "202611", actual = november, expected = "000002" });
        Expect.That(december == "000003", "wrongMonth", new { year = 1999, month = 12, period = "199912", actual = december, expected = "000003" });
        Expect.That(january == "nothing", "emptyMonthNotEmpty", new { expected = "nothing", actual = january });
    }

    [Check("lines-become-payslips")]
    static void LinesBecomePayslips()
    {
        var payroll = new LegacyPayroll(new()
        {
            ["202605"] =
            [
                Line("004217", "Ana Popescu", 350000),
                Line("000815", "Ion de la Rosa", 1),
                Line("123456", "Alexandra-Maria Popa", 99999999),
            ],
        });
        var slips = Show(new PayrollFeed(payroll).PayslipsFor(2026, 5));

        Expect.That(slips == "004217|Ana Popescu|3500.00 / 000815|Ion de la Rosa|0.01 / 123456|Alexandra-Maria Popa|999999.99", "wrongSlips", new { expected = "004217|Ana Popescu|3500.00 / 000815|Ion de la Rosa|0.01 / 123456|Alexandra-Maria Popa|999999.99", actual = slips });
    }

    [Check("report-totals-any-feed")]
    static void ReportTotalsAnyFeed()
    {
        var feed = new TestFeed(new Payslip("1", "A", 1200.50m), new Payslip("2", "B", 799.50m), new Payslip("3", "C", 0.25m));
        var total = new PayrollReport(feed).Total(2026, 7);
        var none = new PayrollReport(new TestFeed()).Total(2026, 8);

        Expect.That(total == 2000.25m, "wrongTotal", new { actual = total });
        Expect.That(string.Join(", ", feed.Asked) == "2026-7", "askedWrongMonth", new { asked = string.Join(", ", feed.Asked) });
        Expect.That(none == 0m, "wrongEmptyTotal", new { actual = none });
    }

    [Check("report-reads-the-old-payroll")]
    static void ReportReadsTheOldPayroll()
    {
        var payroll = new LegacyPayroll(new() { ["202602"] = [Line("004217", "Ana Popescu", 350000), Line("000815", "Mihai Ionescu", 412550)] });
        var total = new PayrollReport(new PayrollFeed(payroll)).Total(2026, 2);

        Expect.That(total == 7625.50m, "wrongOldTotal", new { actual = total });
    }

    [Check("report-knows-only-the-feed")]
    static void ReportKnowsOnlyTheFeed()
    {
        Expect.That(typeof(IPayslipFeed).IsAssignableFrom(typeof(PayrollFeed)), "notAFeed");
        Expect.That(!typeof(IPayslipFeed).IsAssignableFrom(typeof(LegacyPayroll)), "payrollChanged");

        var fields = new List<FieldInfo>();
        for (var t = typeof(PayrollReport); t is not null && t != typeof(object); t = t.BaseType)
            fields.AddRange(t.GetFields(Declared));
        var named = fields.FirstOrDefault(f => f.FieldType == typeof(LegacyPayroll) || f.FieldType == typeof(PayrollFeed));
        Expect.That(named is null, "reportNamesPayroll", new { type = named?.FieldType.Name });
    }
}
