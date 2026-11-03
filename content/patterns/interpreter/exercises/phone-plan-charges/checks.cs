using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PhonePlanChecks
{
    // Four months of usage, each with the words the failure messages use for it.
    static readonly (Usage Usage, string Said)[] Months =
    [
        (new Usage(80, 20, 3), "80 minutes, 20 texts and 3 GB"),
        (new Usage(160, 70, 5), "160 minutes, 70 texts and 5 GB"),
        (new Usage(400, 10, 2), "400 minutes, 10 texts and 2 GB"),
        (new Usage(100, 50, 9), "100 minutes, 50 texts and 9 GB"),
    ];

    // Prices the sentence for each of the four months.
    static void Prices(ICharge charge, string sentence, int[] expected)
    {
        for (var i = 0; i < Months.Length; i++)
        {
            var actual = charge.Price(Months[i].Usage);
            Expect.That(actual == expected[i], "wrongPrice", new { sentence, usage = Months[i].Said, expected = expected[i], actual });
        }
    }

    [Check("times-multiplies-its-parts")]
    static void TimesMultipliesItsParts()
    {
        Prices(new Times(new Used("texts"), new Fixed(5)), "Times(Used(\"texts\"), Fixed(5))", [100, 350, 50, 250]);
        Prices(new Times(new Plus(new Used("gigabytes"), new Fixed(1)), new Times(new Fixed(2), new Used("gigabytes"))),
            "Times(Plus(Used(\"gigabytes\"), Fixed(1)), Times(Fixed(2), Used(\"gigabytes\")))", [24, 60, 12, 180]);
    }

    [Check("over-keeps-only-what-is-above")]
    static void OverKeepsOnlyWhatIsAbove()
    {
        Prices(new Over(100, new Used("minutes")), "Over(100, Used(\"minutes\"))", [0, 60, 300, 0]);
        Prices(new Over(10, new Times(new Used("gigabytes"), new Fixed(4))), "Over(10, Times(Used(\"gigabytes\"), Fixed(4)))", [2, 10, 0, 26]);
    }

    [Check("smaller-picks-the-lower-part")]
    static void SmallerPicksTheLowerPart()
    {
        Prices(new Smaller(new Used("minutes"), new Fixed(150)), "Smaller(Used(\"minutes\"), Fixed(150))", [80, 150, 150, 100]);
        Prices(new Smaller(new Times(new Used("texts"), new Fixed(3)), new Plus(new Used("minutes"), new Fixed(20))),
            "Smaller(Times(Used(\"texts\"), Fixed(3)), Plus(Used(\"minutes\"), Fixed(20)))", [60, 180, 30, 120]);
    }

    [Check("whole-plans-price-every-month")]
    static void WholePlansPriceEveryMonth()
    {
        Prices(new Smaller(new Plus(new Fixed(1500), new Times(new Over(100, new Used("minutes")), new Fixed(10))), new Fixed(4000)),
            "Smaller(Plus(Fixed(1500), Times(Over(100, Used(\"minutes\")), Fixed(10))), Fixed(4000))", [1500, 2100, 4000, 1500]);
        Prices(new Plus(new Smaller(new Times(new Over(2, new Used("gigabytes")), new Fixed(300)), new Fixed(1000)),
                new Times(new Over(50, new Used("texts")), new Fixed(5))),
            "Plus(Smaller(Times(Over(2, Used(\"gigabytes\")), Fixed(300)), Fixed(1000)), Times(Over(50, Used(\"texts\")), Fixed(5)))",
            [300, 1000, 0, 1000]);
    }

    [Check("each-part-works-out-its-own-price")]
    static void EachPartWorksOutItsOwnPrice()
    {
        foreach (var type in new[] { typeof(Times), typeof(Over), typeof(Smaller) })
            Expect.That(WorksItOut(type, typeof(ICharge), "Price"), "notItsOwnPrice", new { type = type.Name });

        var test = TypeTest(["Fixed", "Used", "Plus", "Times", "Over", "Smaller"]);
        Expect.That(test is null, "typeTest", new { code = test });
    }

    // The class works out its own answer: the method is written in the class, or in a class of its own between it and the base.
    static bool WorksItOut(Type type, Type @base, string method)
    {
        if (!@base.IsAssignableFrom(type)) return false;
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType != @base && found.DeclaringType != typeof(object);
    }

    // The first piece of code that tests whether something is one of the named classes; null when there is none.
    static string? TypeTest(string[] names)
    {
        static string Name(SyntaxNode? n) => n switch
        {
            QualifiedNameSyntax q => q.Right.Identifier.ValueText,
            SimpleNameSyntax s => s.Identifier.ValueText,
            _ => "",
        };

        foreach (var node in Source.Root.DescendantNodes())
        {
            SyntaxNode? named = node switch
            {
                BinaryExpressionSyntax b when b.OperatorToken.ValueText is "is" or "as" => b.Right,
                DeclarationPatternSyntax d => d.Type,
                RecursivePatternSyntax r => r.Type,
                TypePatternSyntax t => t.Type,
                ConstantPatternSyntax c => c.Expression,
                CaseSwitchLabelSyntax c => c.Value,
                TypeOfExpressionSyntax t => t.Type,
                _ => null,
            };
            if (named is not null && names.Contains(Name(named))) return node.ToString();
        }
        return null;
    }
}
