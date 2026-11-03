using System.Reflection;
using DesignPatterns.Checks;

static class TennisGameChecks
{
    // Plays the points on a new game, one by one, and compares the score after each with `scores`.
    static void Play(string points, string[] scores)
    {
        var game = new TennisGame();
        for (var i = 0; i < points.Length; i++)
        {
            game.PointTo(points[i].ToString());
            var actual = game.Score;
            Expect.That(actual == scores[i], "wrongScore",
                new { points = string.Join(" ", points[..(i + 1)].ToCharArray()), expected = scores[i], actual });
        }
    }

    [Check("points-count-up-to-a-game")]
    static void PointsCountUpToAGame()
    {
        var game = new TennisGame();
        var start = game.Score;
        Expect.That(start == "0-0", "wrongStart", new { expected = "0-0", actual = start });
        Play("ABAAA", ["15-0", "15-15", "30-15", "40-15", "game A"]);
        Play("BBAB", ["0-15", "0-30", "15-30", "15-40"]);
        Play("BBABB", ["0-15", "0-30", "15-30", "15-40", "game B"]);
        Play("AABBAB", ["15-0", "30-0", "30-15", "30-30", "40-30", "deuce"]);
    }

    [Check("forty-all-is-deuce")]
    static void FortyAllIsDeuce()
    {
        Play("AAABBB", ["15-0", "30-0", "40-0", "40-15", "40-30", "deuce"]);
        Play("BBBAAA", ["0-15", "0-30", "0-40", "15-40", "30-40", "deuce"]);
    }

    [Check("advantage-wins-or-goes-back-to-deuce")]
    static void AdvantageWinsOrGoesBackToDeuce()
    {
        Play("AAABBBABBAABAA", ["15-0", "30-0", "40-0", "40-15", "40-30", "deuce", "advantage A", "deuce", "advantage B", "deuce",
            "advantage A", "deuce", "advantage A", "game A"]);
        Play("ABABABBB", ["15-0", "15-15", "30-15", "30-30", "40-30", "deuce", "advantage B", "game B"]);
    }

    [Check("a-won-game-stays-won")]
    static void AWonGameStaysWon()
    {
        Play("AAAABBBB", ["15-0", "30-0", "40-0", "game A", "game A", "game A", "game A", "game A"]);
        Play("ABABABBBAA", ["15-0", "15-15", "30-15", "30-30", "40-30", "deuce", "advantage B", "game B", "game B", "game B"]);
    }

    [Check("the-game-keeps-no-status-field")]
    static void TheGameKeepsNoStatusField() => ExpectNoStatusField(typeof(TennisGame));

    [Check("one-class-per-stage")]
    static void OneClassPerStage() => ExpectOneClassPerStage(typeof(TennisGame), 4);

    // ---- The class keeps its current stage as an object ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // The fields of the class and of every class of ours it inherits from.
    static IEnumerable<FieldInfo> Fields(Type owner)
    {
        for (var type = owner; type is not null && type.Assembly == owner.Assembly; type = type.BaseType)
            foreach (var field in type.GetFields(AnyField))
                yield return field;
    }

    // No field that can change (neither const nor readonly) is of an enum type, string or bool, nullable included.
    static void ExpectNoStatusField(Type owner)
    {
        foreach (var field in Fields(owner).Where(f => !f.IsLiteral && !f.IsInitOnly))
        {
            var type = Nullable.GetUnderlyingType(field.FieldType) ?? field.FieldType;
            Expect.That(!type.IsEnum && type != typeof(string) && type != typeof(bool), "statusField",
                new { type = owner.Name, field = Shown(field), fieldType = type.Name });
        }
    }

    // An instance field that is not readonly is typed as an interface or class of ours that at least `count`
    // non-abstract classes of ours are, not counting the field's own type and the owner.
    static void ExpectOneClassPerStage(Type owner, int count)
    {
        var classes = owner.Assembly.GetTypes().Where(c => c.IsClass && !c.IsAbstract && c != owner).ToList();
        var candidates = Fields(owner)
            .Where(f => !f.IsStatic && !f.IsInitOnly && f.FieldType.Assembly == owner.Assembly && (f.FieldType.IsInterface || f.FieldType.IsClass))
            .Select(f => (Field: f, Count: classes.Count(c => c != f.FieldType && f.FieldType.IsAssignableFrom(c))))
            .Where(x => x.Count > 0)
            .OrderByDescending(x => x.Count)
            .ToList();
        if (candidates.Count == 0) Expect.Fail("noStageField", new { type = owner.Name });
        var best = candidates[0];
        Expect.That(best.Count >= count, "tooFewStages",
            new { type = owner.Name, field = Shown(best.Field), fieldType = best.Field.FieldType.Name, expected = count, actual = best.Count });
    }

    // The field's name as written: "<stage>P" and "<Score>k__BackingField" become "stage" and "Score".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
