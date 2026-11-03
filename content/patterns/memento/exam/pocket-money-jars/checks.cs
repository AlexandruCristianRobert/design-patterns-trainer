using System.Reflection;
using DesignPatterns.Checks;

static class PocketMoneyChecks
{
    static void Step(Jars jars, string said, string expected)
    {
        var actual = jars.Show();
        Expect.That(actual == expected, "wrongJars", new { step = said, expected, actual });
    }

    static void Applied(MoneyMoves moves, string said, bool expected)
    {
        var actual = moves.Apply();
        Expect.That(actual == expected, "wrongResult", new { step = said, expected, actual });
        Expect.That(moves.Waiting == 0, "stillWaiting", new { step = said, expected = 0, actual = moves.Waiting });
    }

    [Check("the-jars-take-only-what-they-hold")]
    static void TheJarsTakeOnlyWhatTheyHold()
    {
        var jars = new Jars();
        Step(jars, "opening new jars", "spend 0, save 0, give 0");
        jars.Put("spend", 20);
        jars.Put("give", 2);
        var took = jars.Take("spend", 5);
        Expect.That(took, "wrongTake", new { step = "taking 5 from spend, which holds 20", expected = true, actual = took });
        Step(jars, "putting 20 in spend and 2 in give, and taking 5 from spend", "spend 15, save 0, give 2");
        took = jars.Take("give", 3);
        Expect.That(!took, "wrongTake", new { step = "taking 3 from give, which holds 2", expected = false, actual = took });
        Step(jars, "then taking 3 from give, which holds 2", "spend 15, save 0, give 2");
        var inSpend = jars.In("spend");
        Expect.That(inSpend == 15, "wrongIn", new { jar = "spend", expected = 15, actual = inSpend });
    }

    [Check("apply-makes-every-move")]
    static void ApplyMakesEveryMove()
    {
        var jars = new Jars();
        jars.Put("spend", 30);
        var moves = new MoneyMoves(jars);
        moves.Add("spend", "save", 10);
        moves.Add("save", "give", 4);
        moves.Add("spend", "give", 5);
        var waiting = moves.Waiting;
        Expect.That(waiting == 3, "wrongWaiting", new { expected = 3, actual = waiting });
        Applied(moves, "applying 3 moves that can all be made", true);
        Step(jars, "moving 10 from spend to save, 4 from save to give and 5 from spend to give", "spend 15, save 6, give 9");
    }

    [Check("a-move-that-cannot-be-made-puts-every-jar-back")]
    static void AMoveThatCannotBeMadePutsEveryJarBack()
    {
        var jars = new Jars();
        jars.Put("spend", 10);
        jars.Put("save", 3);
        var moves = new MoneyMoves(jars);
        moves.Add("spend", "save", 6);
        moves.Add("save", "give", 8);
        moves.Add("spend", "give", 5);
        Applied(moves, "applying 3 moves where the third needs 5 from spend, which then holds 4", false);
        Step(jars, "a third move that could not be made", "spend 10, save 3, give 0");

        moves.Add("give", "spend", 1);
        Applied(moves, "applying a move from the empty give jar", false);
        Step(jars, "a first move that could not be made", "spend 10, save 3, give 0");

        moves.Add("spend", "give", 5);
        Applied(moves, "then applying a move of 5 from spend to give", true);
        Step(jars, "then moving 5 from spend to give", "spend 5, save 3, give 5");
    }

    [Check("saved-totals-stay-as-they-were")]
    static void SavedTotalsStayAsTheyWere()
    {
        var jars = new Jars();
        jars.Put("save", 12);
        var totals = jars.Save();
        jars.Take("save", 7);
        jars.Put("give", 4);
        jars.Restore(totals);
        Step(jars, "saving with 12 in save, taking 7 from save, putting 4 in give and restoring", "spend 0, save 12, give 0");
        jars.Put("spend", 9);
        jars.Take("save", 12);
        jars.Restore(totals);
        Step(jars, "then changing the restored jars and restoring the same totals again", "spend 0, save 12, give 0");
    }

    [Check("nothing-else-can-read-saved-totals")]
    static void NothingElseCanReadSavedTotals() => ExpectNothingPublicInside(new Jars().Save());

    [Check("the-jars-keep-their-money-to-themselves")]
    static void TheJarsKeepTheirMoneyToThemselves() => ExpectKeepsItsOwn(typeof(Jars));

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(Jars).Assembly;
        var type = saved.GetType();
        Expect.That(type.Assembly == ours, "notOurs", new { type = type.Name });
        var types = new List<Type>();
        for (var t = type; t is not null && t.Assembly == ours; t = t.BaseType) types.Add(t);
        types.AddRange(type.GetInterfaces().Where(i => i.Assembly == ours));
        foreach (var t in types.Where(t => t.IsVisible))
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicInside", new { type = t.Name, member = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.GetMethod?.IsPublic == true || p.SetMethod?.IsPublic == true))
                Expect.Fail("publicInside", new { type = t.Name, member = property.Name });
        }
    }

    // ---- The class keeps what it holds to itself ----

    // Neither the class nor a class of ours it inherits from has a public field (constants aside) or a public property
    // with a public set or init.
    static void ExpectKeepsItsOwn(Type owner)
    {
        for (var t = owner; t is not null && t.Assembly == owner.Assembly; t = t.BaseType)
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicField", new { type = owner.Name, field = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.SetMethod?.IsPublic == true))
                Expect.Fail("publicSetter", new { type = owner.Name, property = property.Name });
        }
    }
}
