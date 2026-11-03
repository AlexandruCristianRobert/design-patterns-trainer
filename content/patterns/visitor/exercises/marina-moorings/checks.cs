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
        var all = Fees(new YachtMooring("Ana", 12), new MotorboatMooring("Ben", 9, true), new HouseboatMooring("Cleo", 3), new MotorboatMooring("Dan", 6, false));
        Expect.That(all == 144, "wrongTotal", new { expected = 144, actual = all });
    }

    [Check("dock-list-has-a-line-per-mooring")]
    static void DockListHasALinePerMooring()
    {
        IMooring[] moorings = [new YachtMooring("Ana", 12), new MotorboatMooring("Ben", 9, true), new HouseboatMooring("Cleo", 3), new MotorboatMooring("Dan", 6, false), new HouseboatMooring("Eva", 1)];
        var dock = new DockList();
        foreach (var mooring in moorings) mooring.Accept(dock);
        const string expected = "Ana: yacht, 12 m | Ben: motorboat, 9 m, shore power | Cleo: houseboat, 3 berths, empty the tank | Dan: motorboat, 6 m, no shore power | Eva: houseboat, 1 berths, empty the tank";
        var actual = string.Join(" | ", dock.Lines);
        Expect.That(actual == expected, "wrongLines", new { expected, actual });
    }

    [Check("each-mooring-calls-its-own-visit")]
    static void EachMooringCallsItsOwnVisit()
    {
        (string Mooring, IMooring Made)[] moorings = [("YachtMooring", new YachtMooring("Ana", 12)), ("MotorboatMooring", new MotorboatMooring("Ben", 9, true)), ("HouseboatMooring", new HouseboatMooring("Cleo", 3))];
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
