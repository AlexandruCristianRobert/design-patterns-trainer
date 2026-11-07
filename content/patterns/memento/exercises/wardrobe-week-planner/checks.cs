using System.Reflection;
using System.Runtime.CompilerServices;
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

    // The class (and any class of ours it inherits from) has no public field and no public property.
    static void ExpectNoPublicState(Type owner)
    {
        for (var t = owner; t is not null && t.Assembly == owner.Assembly; t = t.BaseType)
        {
            foreach (var field in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral))
                Expect.Fail("publicField", new { type = owner.Name, field = field.Name });
            foreach (var property in t.GetProperties(Declared).Where(p => p.GetMethod?.IsPublic == true || p.SetMethod?.IsPublic == true))
                Expect.Fail("publicProperty", new { type = owner.Name, property = property.Name });
        }
    }

    // Only WeekPlan can look inside a saved copy. Every class it is (object aside) and every interface it implements (a
    // record's own IEquatable aside) is ours, so it cannot be read as a list or dictionary. And every one of those types
    // that code outside can name has no public members, constructors aside. A private nested or internal type cannot
    // be named from outside, so it may have them.
    static void ExpectNothingPublicInside(object saved)
    {
        var ours = typeof(WeekPlan).Assembly;
        var type = saved.GetType();
        var types = new List<Type>();
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
        {
            if (t.Assembly != ours) Expect.Fail("foreignType", new { type = type.Name, other = t.Name });
            types.Add(t);
        }
        foreach (var i in type.GetInterfaces())
        {
            if (i.Assembly == ours) types.Add(i);
            else if (!(i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEquatable<>) && i.GetGenericArguments()[0] == type))
                Expect.Fail("foreignType", new { type = type.Name, other = i.Name });
        }
        foreach (var t in types.Where(t => t.IsVisible))
            foreach (var member in PublicMembers(t))
                Expect.Fail("publicInside", new { type = t.Name, member });
    }

    // Public fields (constants aside), properties, methods and events declared on the type. Property accessors,
    // operators and the members the compiler writes for a record are left out.
    static IEnumerable<string> PublicMembers(Type t)
    {
        foreach (var f in t.GetFields(Declared).Where(f => f.IsPublic && !f.IsLiteral)) yield return f.Name;
        foreach (var p in t.GetProperties(Declared).Where(p => p.GetMethod?.IsPublic == true || p.SetMethod?.IsPublic == true))
            yield return p.Name;
        foreach (var m in t.GetMethods(Declared).Where(m => m.IsPublic && !m.IsSpecialName && !m.IsDefined(typeof(CompilerGeneratedAttribute))))
            yield return m.Name;
        foreach (var e in t.GetEvents(Declared).Where(e => e.AddMethod?.IsPublic == true)) yield return e.Name;
    }
}
