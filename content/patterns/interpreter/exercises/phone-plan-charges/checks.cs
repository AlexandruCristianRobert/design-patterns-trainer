using System.Reflection;
using DesignPatterns.Checks;

static class PhonePlanChecks
{
    // Three months of usage, each with the words the failure messages use for it.
    static readonly (Usage Usage, string Said)[] Months =
    [
        (new Usage(80, 20), "80 minutes and 20 texts"),
        (new Usage(160, 70), "160 minutes and 70 texts"),
        (new Usage(300, 5), "300 minutes and 5 texts"),
    ];

    // Prices the sentence for each of the three months.
    static void Prices(ICharge charge, string sentence, int[] expected)
    {
        for (var i = 0; i < Months.Length; i++)
        {
            var actual = charge.Price(Months[i].Usage);
            Expect.That(actual == expected[i], "wrongPrice", new { sentence, usage = Months[i].Said, expected = expected[i], actual });
        }
    }

    [Check("used-reads-the-month")]
    static void UsedReadsTheMonth()
    {
        Prices(new Used("minutes"), "Used(\"minutes\")", [80, 160, 300]);
        Prices(new Used("texts"), "Used(\"texts\")", [20, 70, 5]);
    }

    [Check("times-multiplies-its-parts")]
    static void TimesMultipliesItsParts()
    {
        Prices(new Times(new Fixed(3), new Fixed(4)), "Times(Fixed(3), Fixed(4))", [12, 12, 12]);
        Prices(new Times(new Plus(new Fixed(2), new Fixed(3)), new Fixed(7)), "Times(Plus(Fixed(2), Fixed(3)), Fixed(7))", [35, 35, 35]);
    }

    [Check("whole-plans-price-every-month")]
    static void WholePlansPriceEveryMonth()
    {
        Prices(new Plus(new Fixed(1500), new Times(new Used("minutes"), new Fixed(10))),
            "Plus(Fixed(1500), Times(Used(\"minutes\"), Fixed(10)))", [2300, 3100, 4500]);
        Prices(new Times(new Plus(new Used("minutes"), new Used("texts")), new Fixed(2)),
            "Times(Plus(Used(\"minutes\"), Used(\"texts\")), Fixed(2))", [200, 460, 610]);
        Prices(new Plus(new Times(new Used("minutes"), new Fixed(10)), new Times(new Times(new Used("texts"), new Fixed(5)), new Fixed(2))),
            "Plus(Times(Used(\"minutes\"), Fixed(10)), Times(Times(Used(\"texts\"), Fixed(5)), Fixed(2)))", [1000, 2300, 3050]);
    }

    [Check("each-word-is-its-own-class")]
    static void EachWordIsItsOwnClass()
    {
        foreach (var type in new[] { typeof(Fixed), typeof(Used), typeof(Plus), typeof(Times) })
        {
            Expect.That(typeof(ICharge).IsAssignableFrom(type), "notACharge", new { type = type.Name });
            Expect.That(HasOwn(type, "Price"), "notItsOwn", new { type = type.Name });
        }
    }

    // The type writes the method itself (an override, an interface method or an explicit one), not only inherits it.
    static bool HasOwn(Type type, string method) =>
        type.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly)
            .Any(m => !m.IsAbstract && (m.Name == method || m.Name.EndsWith("." + method)));
}
