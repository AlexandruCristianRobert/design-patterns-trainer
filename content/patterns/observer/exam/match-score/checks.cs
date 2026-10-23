using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class MatchScoreChecks
{
    class Recorder : IScoreScreen
    {
        public List<(int Home, int Away)> Shown { get; } = [];
        public virtual void ShowScore(int homeGoals, int awayGoals) => Shown.Add((homeGoals, awayGoals));
    }

    // Switches itself off the first time it is shown a score.
    sealed class OneShot(Match match) : Recorder
    {
        public override void ShowScore(int homeGoals, int awayGoals)
        {
            base.ShowScore(homeGoals, awayGoals);
            match.RemoveScreen(this);
        }
    }

    // The type itself plus every element and generic argument type, e.g. List<PhoneApp> yields List<PhoneApp> and PhoneApp.
    static IEnumerable<Type> Mentioned(Type t)
    {
        yield return t;
        if (t.GetElementType() is { } element)
            foreach (var x in Mentioned(element)) yield return x;
        if (t.IsGenericType)
            foreach (var arg in t.GetGenericArguments())
                foreach (var x in Mentioned(arg)) yield return x;
    }

    static string Show(List<(int Home, int Away)> shown) =>
        shown.Count == 0 ? "nothing" : string.Join(", ", shown.Select(s => $"{s.Home}-{s.Away}"));

    [Check("every-screen-shows-score")]
    static void EveryScreenShowsScore()
    {
        var match = new Match("Rapid", "Dinamo");
        var screens = new[] { new Recorder(), new Recorder(), new Recorder() };
        foreach (var s in screens) match.AddScreen(s);

        match.Score("Rapid");
        match.Score("Dinamo");
        match.Score("Dinamo");

        for (var i = 0; i < screens.Length; i++)
            Expect.That(screens[i].Shown.SequenceEqual([(1, 0), (1, 1), (1, 2)]), "wrongScores",
                new { screen = i + 1, actual = Show(screens[i].Shown) });
    }

    [Check("removed-screen-not-shown")]
    static void RemovedScreenNotShown()
    {
        var match = new Match("Rapid", "Dinamo");
        var leaving = new Recorder();
        var staying = new Recorder();
        match.AddScreen(leaving);
        match.AddScreen(staying);
        match.Score("Rapid");

        match.RemoveScreen(leaving);
        match.Score("Dinamo");

        Expect.That(leaving.Shown.SequenceEqual([(1, 0)]), "shownAfterRemove", new { actual = Show(leaving.Shown) });
        Expect.That(staying.Shown.SequenceEqual([(1, 0), (1, 1)]), "stayingMissed", new { actual = Show(staying.Shown) });
    }

    [Check("screen-can-leave-during-goal")]
    static void ScreenCanLeaveDuringGoal()
    {
        var match = new Match("Rapid", "Dinamo");
        var before = new Recorder();
        var leaving = new OneShot(match);
        var after = new Recorder();
        match.AddScreen(before);
        match.AddScreen(leaving);
        match.AddScreen(after);

        match.Score("Rapid");
        match.Score("Rapid");

        Expect.That(leaving.Shown.SequenceEqual([(1, 0)]), "leaverShownAgain", new { actual = Show(leaving.Shown) });
        Expect.That(before.Shown.SequenceEqual([(1, 0), (2, 0)]) && after.Shown.SequenceEqual([(1, 0), (2, 0)]),
            "othersMissed", new { actual = Show(after.Shown) });
    }

    [Check("no-screens-ok")]
    static void NoScreensOk()
    {
        var match = new Match("Rapid", "Dinamo");
        match.Score("Rapid");

        var stranger = new Recorder();
        match.RemoveScreen(stranger);
        match.Score("Dinamo");

        var late = new Recorder();
        match.AddScreen(late);
        match.Score("Dinamo");

        Expect.That(stranger.Shown.Count == 0, "strangerShown");
        Expect.That(late.Shown.SequenceEqual([(1, 2)]), "goalsLostWhileEmpty", new { actual = Show(late.Shown) });
    }

    [Check("match-knows-only-the-interface")]
    static void MatchKnowsOnlyTheInterface()
    {
        var concrete = typeof(IScoreScreen).Assembly.GetTypes()
            .Where(t => !t.IsInterface && typeof(IScoreScreen).IsAssignableFrom(t) && t.DeclaringType != typeof(MatchScoreChecks))
            .Select(t => t.Name).ToHashSet();

        var fields = Code.Type("Match").Clr.GetFields(BindingFlags.Instance | BindingFlags.Static |
            BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
        foreach (var field in fields)
        {
            var named = Mentioned(field.FieldType).FirstOrDefault(t => concrete.Contains(t.Name));
            Expect.That(named is null, "concreteField", new { type = named?.Name });
        }

        foreach (var declaration in Source.Root.DescendantNodes().OfType<ClassDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "Match"))
        {
            var named = declaration.DescendantNodes().OfType<IdentifierNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "matchNamesScreen", new { type = named });
        }
    }
}
