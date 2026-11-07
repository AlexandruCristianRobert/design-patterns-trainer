using System.Reflection;
using DesignPatterns.Checks;

static class BinCollectionChecks
{
    // Four days, each with the words the failure messages use for it.
    static readonly (CollectionDay Day, string Said)[] Days =
    [
        (new CollectionDay("Tue", false), "a Tuesday"),
        (new CollectionDay("Tue", true), "a Tuesday that is a public holiday"),
        (new CollectionDay("Fri", false), "a Friday"),
        (new CollectionDay("Wed", true), "a Wednesday that is a public holiday"),
    ];

    // Asks the rule about each of the four days.
    static void Try(BinRule rule, string written, bool[] expected)
    {
        for (var i = 0; i < Days.Length; i++)
        {
            var actual = rule.Collects(Days[i].Day);
            Expect.That(actual == expected[i], "wrongDay", new { rule = written, day = Days[i].Said, expected = expected[i], actual });
        }
    }

    [Check("simple-rules-pick-the-right-days")]
    static void SimpleRulesPickTheRightDays()
    {
        Try(new OnWeekday("Tue"), "OnWeekday(\"Tue\")", [true, true, false, false]);
        Try(new OnWeekday("Fri"), "OnWeekday(\"Fri\")", [false, false, true, false]);
        Try(new PublicHoliday(), "PublicHoliday()", [false, true, false, true]);
    }

    [Check("combined-rules-ask-the-rules-they-hold")]
    static void CombinedRulesAskTheRulesTheyHold()
    {
        Try(new AnyOf(new OnWeekday("Tue"), new OnWeekday("Fri")), "AnyOf(OnWeekday(\"Tue\"), OnWeekday(\"Fri\"))", [true, true, true, false]);
        Try(new AnyOf(new OnWeekday("Fri"), new PublicHoliday()), "AnyOf(OnWeekday(\"Fri\"), PublicHoliday())", [false, true, true, true]);
        Try(new Unless(new OnWeekday("Tue"), new PublicHoliday()), "Unless(OnWeekday(\"Tue\"), PublicHoliday())", [true, false, false, false]);
        Try(new Unless(new PublicHoliday(), new OnWeekday("Tue")), "Unless(PublicHoliday(), OnWeekday(\"Tue\"))", [false, false, false, true]);
    }

    [Check("nested-rules-pick-the-right-days")]
    static void NestedRulesPickTheRightDays()
    {
        Try(new Unless(new AnyOf(new OnWeekday("Tue"), new OnWeekday("Fri")), new PublicHoliday()),
            "Unless(AnyOf(OnWeekday(\"Tue\"), OnWeekday(\"Fri\")), PublicHoliday())", [true, false, true, false]);
        Try(new AnyOf(new Unless(new OnWeekday("Tue"), new PublicHoliday()), new AnyOf(new OnWeekday("Wed"), new OnWeekday("Fri"))),
            "AnyOf(Unless(OnWeekday(\"Tue\"), PublicHoliday()), AnyOf(OnWeekday(\"Wed\"), OnWeekday(\"Fri\")))", [true, false, true, true]);
        Try(new Unless(new AnyOf(new PublicHoliday(), new OnWeekday("Fri")), new Unless(new OnWeekday("Wed"), new OnWeekday("Tue"))),
            "Unless(AnyOf(PublicHoliday(), OnWeekday(\"Fri\")), Unless(OnWeekday(\"Wed\"), OnWeekday(\"Tue\")))", [false, true, true, false]);
    }

    [Check("one-class-per-rule")]
    static void OneClassPerRule()
    {
        foreach (var type in new[] { typeof(OnWeekday), typeof(PublicHoliday), typeof(AnyOf), typeof(Unless) })
        {
            Expect.That(typeof(BinRule).IsAssignableFrom(type), "notARule", new { type = type.Name });
            Expect.That(HasOwn(type, "Collects"), "notItsOwn", new { type = type.Name });
        }
    }

    // The type writes the method itself (an override, an interface method or an explicit one), not only inherits it.
    static bool HasOwn(Type type, string method) =>
        type.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly)
            .Any(m => !m.IsAbstract && (m.Name == method || m.Name.EndsWith("." + method)));
}
