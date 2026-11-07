using DesignPatterns.Checks;

static class MarinaMooringsChecks
{
    // A new report the mooring classes have never seen: it writes down which Visit each mooring called.
    sealed class NewReport : IMooringVisitor
    {
        public List<string> Calls { get; } = new();

        public void Visit(YachtMooring mooring) => Calls.Add("Visit(YachtMooring)");
        public void Visit(MotorboatMooring mooring) => Calls.Add("Visit(MotorboatMooring)");
        public void Visit(HouseboatMooring mooring) => Calls.Add("Visit(HouseboatMooring)");
    }

    static int Fees(params IMooring[] moorings)
    {
        var fees = new NightlyFees();
        foreach (var mooring in moorings) mooring.Accept(fees);
        return fees.Total;
    }

    [Check("fees-count-every-mooring")]
    static void FeesCountEveryMooring()
    {
        var houseboat = Fees(new HouseboatMooring("Cleo", 3));
        Expect.That(houseboat == 45, "houseboatNotCounted", new { expected = 45, actual = houseboat });
        var all = Fees(new YachtMooring("Ana", 12), new MotorboatMooring("Ben", 9), new HouseboatMooring("Cleo", 3), new MotorboatMooring("Dan", 6));
        Expect.That(all == 111, "wrongTotal", new { expected = 111, actual = all });
    }

    [Check("dock-list-has-a-line-per-mooring")]
    static void DockListHasALinePerMooring()
    {
        IMooring[] moorings = [new YachtMooring("Ana", 12), new MotorboatMooring("Ben", 9), new HouseboatMooring("Cleo", 3), new MotorboatMooring("Dan", 6)];
        var dock = new DockList();
        foreach (var mooring in moorings) mooring.Accept(dock);
        const string expected = "Ana: yacht, 12 m | Ben: motorboat, 9 m | Cleo: houseboat, 3 berths | Dan: motorboat, 6 m";
        var actual = string.Join(" | ", dock.Lines);
        Expect.That(actual == expected, "wrongLines", new { expected, actual });
    }

    [Check("each-mooring-calls-its-own-visit")]
    static void EachMooringCallsItsOwnVisit()
    {
        (string Mooring, IMooring Made)[] moorings = [("YachtMooring", new YachtMooring("Ana", 12)), ("MotorboatMooring", new MotorboatMooring("Ben", 9)), ("HouseboatMooring", new HouseboatMooring("Cleo", 3))];
        foreach (var (mooring, made) in moorings)
        {
            var report = new NewReport();
            made.Accept(report);
            var expected = $"Visit({mooring})";
            var actual = report.Calls.Count == 0 ? "nothing" : string.Join(", ", report.Calls);
            Expect.That(actual == expected, "wrongVisit", new { mooring, expected, actual });
        }
    }
}
