using System.Reflection;
using DesignPatterns.Checks;

static class WardrobeWeekChecks
{
    static void Step(WeekPlan plan, string said, string expected)
    {
        var actual = plan.Show();
        Expect.That(actual == expected, "wrongWeek", new { step = said, expected, actual });
    }

    [Check("the-plan-shows-the-week-in-order")]
    static void ThePlanShowsTheWeekInOrder()
    {
        var plan = new WeekPlan();
        Step(plan, "making a new plan", "nothing planned");
        plan.Wear("Sun", "pyjamas");
        plan.Wear("Tue", "jeans");
        plan.Wear("Thu", "dress");
        Step(plan, "wearing pyjamas on Sun, jeans on Tue and a dress on Thu", "Tue jeans, Thu dress, Sun pyjamas");
        plan.Wear("Tue", "chinos");
        Step(plan, "then wearing chinos on Tue", "Tue chinos, Thu dress, Sun pyjamas");
        plan.Clear("Thu");
        plan.Clear("Mon");
        Step(plan, "then clearing Thu and Mon", "Tue chinos, Sun pyjamas");
    }

    [Check("restore-brings-back-the-saved-week")]
    static void RestoreBringsBackTheSavedWeek()
    {
        var plan = new WeekPlan();
        plan.Wear("Mon", "jeans");
        var first = plan.Save();
        plan.Wear("Wed", "suit");
        var second = plan.Save();
        plan.Wear("Mon", "shorts");
        plan.Clear("Wed");
        plan.Wear("Sat", "kilt");

        plan.Restore(second);
        Step(plan, "saving two weeks, changing more and restoring the second one", "Mon jeans, Wed suit");
        plan.Restore(first);
        Step(plan, "then restoring the first one", "Mon jeans");
        plan.Restore(second);
        Step(plan, "then restoring the second one again", "Mon jeans, Wed suit");
    }

    [Check("later-changes-do-not-reach-a-saved-week")]
    static void LaterChangesDoNotReachASavedWeek()
    {
        var plan = new WeekPlan();
        plan.Wear("Tue", "jumper");
        plan.Wear("Fri", "shirt");
        var saved = plan.Save();

        plan.Wear("Tue", "coat");
        plan.Clear("Fri");
        plan.Wear("Sun", "boots");
        plan.Restore(saved);
        Step(plan, "saving, changing Tue, clearing Fri, adding Sun and restoring", "Tue jumper, Fri shirt");

        plan.Wear("Fri", "tie");
        plan.Wear("Mon", "hat");
        plan.Restore(saved);
        Step(plan, "then changing the restored plan and restoring the same saved week again", "Tue jumper, Fri shirt");
    }

    [Check("the-history-gives-back-the-last-week-first")]
    static void TheHistoryGivesBackTheLastWeekFirst()
    {
        var plan = new WeekPlan();
        var history = new PlanHistory();
        var weeks = new List<ISavedWeek>();
        foreach (var outfit in new[] { "jeans", "suit", "shorts" })
        {
            plan.Wear("Mon", outfit);
            weeks.Add(plan.Save());
            history.Keep(weeks[^1]);
        }
        Expect.That(history.Count == 3, "wrongCount", new { step = "keeping 3 weeks", expected = 3, actual = history.Count });

        for (var i = 0; i < 3; i++)
        {
            var back = history.Back();
            Expect.That(ReferenceEquals(back, weeks[2 - i]), "wrongBack", new { kept = 3, backs = i + 1, expected = 3 - i });
        }
        Expect.That(history.Back() is null, "notNull", new { kept = 3 });
        Expect.That(history.Count == 0, "wrongCount", new { step = "keeping 3 weeks and giving them all back", expected = 0, actual = history.Count });
    }

    [Check("the-history-keeps-the-last-five")]
    static void TheHistoryKeepsTheLastFive()
    {
        var plan = new WeekPlan();
        var history = new PlanHistory();
        var weeks = new List<ISavedWeek>();
        for (var i = 1; i <= 7; i++)
        {
            plan.Wear("Sat", $"outfit {i}");
            weeks.Add(plan.Save());
            history.Keep(weeks[^1]);
        }
        Expect.That(history.Count == 5, "wrongCount", new { step = "keeping 7 weeks", expected = 5, actual = history.Count });

        for (var i = 7; i >= 3; i--)
        {
            var back = history.Back();
            Expect.That(ReferenceEquals(back, weeks[i - 1]), "wrongBack", new { kept = 7, backs = 8 - i, expected = i });
        }
        Expect.That(history.Back() is null, "notNull", new { kept = 7 });
    }

    [Check("nothing-else-can-read-a-saved-week")]
    static void NothingElseCanReadASavedWeek()
    {
        var plan = new WeekPlan();
        plan.Wear("Mon", "jeans");
        ExpectNothingPublicInside(plan.Save());
    }

    [Check("the-plan-keeps-its-outfits-to-itself")]
    static void ThePlanKeepsItsOutfitsToItself() => ExpectKeepsItsOwn(typeof(WeekPlan));

    // ---- Nothing outside reads a saved copy ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No type of ours that the saved copy is (its own class or record, a class it inherits from, or an interface it
    // implements) is public all the way out and has a public field (constants aside) or a public property. A private
    // or internal type, or one nested in such a type, may have public members: code outside cannot name it.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(WeekPlan).Assembly;
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
