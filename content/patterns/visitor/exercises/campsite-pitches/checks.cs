using DesignPatterns.Checks;

static class CampsitePitchesChecks
{
    // A new report the pitch classes have never seen: it writes down which Visit each pitch called.
    sealed class NewReport : IPitchVisitor
    {
        public List<string> Calls { get; } = new();

        public void Visit(TentPitch pitch) => Calls.Add("Visit(TentPitch)");
        public void Visit(CaravanPitch pitch) => Calls.Add("Visit(CaravanPitch)");
        public void Visit(YurtPitch pitch) => Calls.Add("Visit(YurtPitch)");
    }

    static int Fees(params IPitch[] pitches)
    {
        var fees = new NightlyFees();
        foreach (var pitch in pitches) pitch.Accept(fees);
        return fees.Total;
    }

    [Check("fees-count-every-pitch")]
    static void FeesCountEveryPitch()
    {
        var yurt = Fees(new YurtPitch("Cleo", 3));
        Expect.That(yurt == 45, "yurtNotCounted", new { expected = 45, actual = yurt });
        var all = Fees(new TentPitch("Ana", 2), new CaravanPitch("Ben", 4, true), new YurtPitch("Cleo", 3), new CaravanPitch("Dan", 2, false));
        Expect.That(all == 120, "wrongTotal", new { expected = 120, actual = all });
    }

    [Check("arrival-list-has-a-line-per-pitch")]
    static void ArrivalListHasALinePerPitch()
    {
        IPitch[] pitches = [new TentPitch("Ana", 2), new CaravanPitch("Ben", 4, true), new YurtPitch("Cleo", 3), new CaravanPitch("Dan", 2, false), new TentPitch("Eva", 1)];
        var arrivals = new ArrivalList();
        foreach (var pitch in pitches) pitch.Accept(arrivals);
        const string expected = "Ana: tent, 2 people | Ben: caravan, 4 people, hook-up | Cleo: yurt, make up 3 beds | Dan: caravan, 2 people, no hook-up | Eva: tent, 1 people";
        var actual = string.Join(" | ", arrivals.Lines);
        Expect.That(actual == expected, "wrongLines", new { expected, actual });
    }

    [Check("each-pitch-calls-its-own-visit")]
    static void EachPitchCallsItsOwnVisit()
    {
        (string Pitch, IPitch Made)[] pitches = [("TentPitch", new TentPitch("Ana", 2)), ("CaravanPitch", new CaravanPitch("Ben", 4, true)), ("YurtPitch", new YurtPitch("Cleo", 3))];
        foreach (var (pitch, made) in pitches)
        {
            var report = new NewReport();
            made.Accept(report);
            var expected = $"Visit({pitch})";
            var actual = report.Calls.Count == 0 ? "nothing" : string.Join(", ", report.Calls);
            Expect.That(actual == expected, "wrongVisit", new { pitch, expected, actual });
        }
    }
}
