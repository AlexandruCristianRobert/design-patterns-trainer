using System.Reflection;
using DesignPatterns.Checks;

static class WardrobeWeekChecks
{
    static void Step(WeekPlan plan, string said, string day, string expected)
    {
        var actual = plan.OutfitOn(day);
        Expect.That(actual == expected, "wrongOutfit", new { step = said, day, expected, actual });
    }

    [Check("restore-brings-back-the-saved-week")]
    static void RestoreBringsBackTheSavedWeek()
    {
        var plan = new WeekPlan();
        plan.Wear("Mon", "jeans");
        var saved = plan.Save();
        plan.Wear("Mon", "shorts");
        plan.Wear("Wed", "suit");

        plan.Restore(saved);
        Step(plan, "saving jeans on Mon, changing Mon to shorts, planning a suit on Wed and restoring", "Mon", "jeans");
        Step(plan, "saving jeans on Mon, changing Mon to shorts, planning a suit on Wed and restoring", "Wed", "nothing");
    }

    [Check("later-changes-do-not-reach-a-saved-week")]
    static void LaterChangesDoNotReachASavedWeek()
    {
        var plan = new WeekPlan();
        plan.Wear("Tue", "jumper");
        var saved = plan.Save();

        plan.Wear("Tue", "coat");
        plan.Restore(saved);
        Step(plan, "saving a jumper on Tue, changing it to a coat and restoring", "Tue", "jumper");

        plan.Wear("Tue", "tie");
        plan.Restore(saved);
        Step(plan, "then changing Tue on the restored plan and restoring the same saved week again", "Tue", "jumper");
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

        for (var i = 0; i < 3; i++)
            Expect.That(ReferenceEquals(history.Back(), weeks[2 - i]), "wrongBack", new { backs = i + 1, expected = 3 - i });
    }

    [Check("nothing-else-can-read-a-saved-week")]
    static void NothingElseCanReadASavedWeek()
    {
        ExpectNoPublicState(typeof(WeekPlan));
        var plan = new WeekPlan();
        plan.Wear("Mon", "jeans");
        ExpectNothingPublicInside(plan.Save());
    }

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // The class (and any class of ours it inherits from) has no public field and no public set or init.
    static void ExpectNoPublicState(Type owner)
    {
        for (var t = owner; t is not null && t.Assembly == owner.Assembly; t = t.BaseType)
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicField", new { type = owner.Name, field = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.SetMethod?.IsPublic == true))
                Expect.Fail("publicSetter", new { type = owner.Name, property = property.Name });
        }
    }

    // No type the saved copy is (its class, a base class or an interface of ours) that code outside can name has a
    // public field or property. A private nested or internal type cannot be named from outside, so it may.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(WeekPlan).Assembly;
        var type = saved.GetType();
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
}
