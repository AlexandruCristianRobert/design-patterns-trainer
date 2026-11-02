using DesignPatterns.Checks;

static class ChessHintChecks
{
    // All Checks share one load of the program, so ChessEngine.Started may already be above 0 when a Check starts.
    // Each Check therefore counts only the engines started while it runs.

    [Check("engine-waits-for-first-hint")]
    static void EngineWaitsForFirstHint()
    {
        var before = ChessEngine.Started;
        var panel = new HintPanel(new LimitedAdvisor(3));
        var early = ChessEngine.Started - before;
        Expect.That(early == 0, "startedTooEarly", new { started = early });

        panel.Ask("e4 e5");
        var started = ChessEngine.Started - before;
        Expect.That(started == 1, "notStartedOnFirstHint", new { started });
    }

    [Check("engine-starts-once")]
    static void EngineStartsOnce()
    {
        var before = ChessEngine.Started;
        var advisor = new LimitedAdvisor(5);
        foreach (var position in new[] { "d4", "d4 d5", "d4 d5 c4", "d4 d5 c4 e6", "d4 d5 c4 e6 Nc3" })
            advisor.Suggest(position);
        var started = ChessEngine.Started - before;

        Expect.That(started == 1, "startedMoreThanOnce", new { started });
    }

    [Check("hints-run-out")]
    static void HintsRunOut()
    {
        var before = ChessEngine.Started;
        var advisor = new LimitedAdvisor(2);
        string[] answers = [advisor.Suggest("c4"), advisor.Suggest("c4 e5"), advisor.Suggest("c4 e5 Nc3"), advisor.Suggest("c4 e5 Nc3 Nf6")];
        var actual = string.Join(" / ", answers);
        Expect.That(actual == "after c4, play Nf3 / after c4 e5, play Nf3 / No hints left / No hints left", "wrongLimit", new { actual });

        var noneBefore = ChessEngine.Started;
        var none = new LimitedAdvisor(0).Suggest("e4");
        var started = ChessEngine.Started - noneBefore;
        Expect.That(none == "No hints left", "wrongZero", new { actual = none });
        Expect.That(started == 0, "startedForNoHint", new { started });
    }

    [Check("hints-match-the-engine")]
    static void HintsMatchTheEngine()
    {
        var hint = new LimitedAdvisor(1).Suggest("e4 c5");
        var real = new ChessEngine().Suggest("e4 c5");

        Expect.That(hint == real && real == "after e4 c5, play Nf3", "differentHint", new { hint, real });
    }

    [Check("panel-works-with-any-advisor")]
    static void PanelWorksWithAnyAdvisor()
    {
        var direct = new HintPanel(new ChessEngine()).Ask("e4 e6");
        var limited = new HintPanel(new LimitedAdvisor(1));
        var first = limited.Ask("e4 e6");
        var second = limited.Ask("e4 e6 d4");

        Expect.That(direct == "Hint: after e4 e6, play Nf3", "wrongDirect", new { actual = direct });
        Expect.That(first == "Hint: after e4 e6, play Nf3" && second == "Hint: No hints left", "wrongLimited", new { first, second });
    }

    [Check("limit-is-an-advisor")]
    static void LimitIsAnAdvisor()
    {
        Expect.That(typeof(IAdvisor).IsAssignableFrom(typeof(ChessEngine)), "engineNotAnAdvisor");
        Expect.That(typeof(IAdvisor).IsAssignableFrom(typeof(LimitedAdvisor)), "limitNotAnAdvisor");
        Expect.That(!typeof(ChessEngine).IsAssignableFrom(typeof(LimitedAdvisor)), "limitIsEngine");
    }
}
