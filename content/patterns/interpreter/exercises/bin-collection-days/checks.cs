using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BinCollectionChecks
{
    // Six days, each with the words the failure messages use for it.
    static readonly (CollectionDay Day, string Said)[] Days =
    [
        (new CollectionDay(1, "Tue", false), "Tuesday of week 1"),
        (new CollectionDay(2, "Tue", false), "Tuesday of week 2"),
        (new CollectionDay(2, "Tue", true), "Tuesday of week 2, a public holiday"),
        (new CollectionDay(4, "Fri", false), "Friday of week 4"),
        (new CollectionDay(12, "Wed", true), "Wednesday of week 12, a public holiday"),
        (new CollectionDay(8, "Fri", false), "Friday of week 8"),
    ];

    // Asks the rule about each of the six days.
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
        Try(new OnWeekday("Tue"), "OnWeekday(\"Tue\")", [true, true, true, false, false, false]);
        Try(new OnWeekday("Fri"), "OnWeekday(\"Fri\")", [false, false, false, true, false, true]);
        Try(new EveryNthWeek(2), "EveryNthWeek(2)", [false, true, true, true, true, true]);
        Try(new EveryNthWeek(4), "EveryNthWeek(4)", [false, false, false, true, true, true]);
        Try(new PublicHoliday(), "PublicHoliday()", [false, false, true, false, true, false]);
    }

    [Check("combined-rules-ask-the-rules-they-hold")]
    static void CombinedRulesAskTheRulesTheyHold()
    {
        Try(new AllOf(new OnWeekday("Tue"), new EveryNthWeek(2)), "AllOf(OnWeekday(\"Tue\"), EveryNthWeek(2))",
            [false, true, true, false, false, false]);
        Try(new AnyOf(new OnWeekday("Fri"), new PublicHoliday()), "AnyOf(OnWeekday(\"Fri\"), PublicHoliday())",
            [false, false, true, true, true, true]);
        Try(new Unless(new OnWeekday("Tue"), new PublicHoliday()), "Unless(OnWeekday(\"Tue\"), PublicHoliday())",
            [true, true, false, false, false, false]);
    }

    [Check("nested-rules-pick-the-right-days")]
    static void NestedRulesPickTheRightDays()
    {
        Try(new Unless(new AllOf(new OnWeekday("Tue"), new EveryNthWeek(2)), new PublicHoliday()),
            "Unless(AllOf(OnWeekday(\"Tue\"), EveryNthWeek(2)), PublicHoliday())",
            [false, true, false, false, false, false]);
        Try(new AnyOf(new AllOf(new OnWeekday("Fri"), new EveryNthWeek(4)),
                new AllOf(new PublicHoliday(), new Unless(new EveryNthWeek(4), new OnWeekday("Tue")))),
            "AnyOf(AllOf(OnWeekday(\"Fri\"), EveryNthWeek(4)), AllOf(PublicHoliday(), Unless(EveryNthWeek(4), OnWeekday(\"Tue\"))))",
            [false, false, false, true, true, true]);
        Try(new Unless(new AnyOf(new OnWeekday("Wed"), new OnWeekday("Fri")),
                new AllOf(new PublicHoliday(), new Unless(new EveryNthWeek(4), new OnWeekday("Fri")))),
            "Unless(AnyOf(OnWeekday(\"Wed\"), OnWeekday(\"Fri\")), AllOf(PublicHoliday(), Unless(EveryNthWeek(4), OnWeekday(\"Fri\"))))",
            [false, false, false, true, false, true]);
    }

    [Check("the-calendar-lists-the-bins-due")]
    static void TheCalendarListsTheBinsDue()
    {
        var empty = new BinCalendar().BinsOn(Days[0].Day);
        Expect.That(empty == "none", "wrongBins", new { bins = "no bins", day = Days[0].Said, expected = "none", actual = empty });

        var calendar = new BinCalendar();
        calendar.Add("paper", new Unless(new AllOf(new OnWeekday("Tue"), new EveryNthWeek(2)), new PublicHoliday()));
        calendar.Add("glass", new AllOf(new OnWeekday("Fri"), new EveryNthWeek(4)));
        calendar.Add("garden", new Unless(new OnWeekday("Tue"), new PublicHoliday()));
        string[] expected = ["garden", "paper, garden", "none", "glass", "none", "glass"];
        for (var i = 0; i < Days.Length; i++)
        {
            var actual = calendar.BinsOn(Days[i].Day);
            Expect.That(actual == expected[i], "wrongBins",
                new { bins = "paper, glass and garden, added in that order", day = Days[i].Said, expected = expected[i], actual });
        }
    }

    [Check("one-class-per-rule")]
    static void OneClassPerRule()
    {
        var rules = new[] { typeof(OnWeekday), typeof(EveryNthWeek), typeof(PublicHoliday), typeof(AllOf), typeof(AnyOf), typeof(Unless) };
        ExpectOwnWork(typeof(BinRule), rules, "Collects");

        var names = rules.Select(t => t.Name).ToArray();
        var test = TypeTest(names);
        Expect.That(test is null, "typeTest", new { code = test });

        foreach (var field in typeof(BinCalendar).GetFields(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic))
            foreach (var concrete in rules)
                Expect.That(!Involves(field.FieldType, concrete), "calendarHoldsConcrete", new { field = field.Name, type = concrete.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "BinCalendar")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => names.Contains(n.Identifier.ValueText));
        Expect.That(named is null, "calendarNamesConcrete", new { type = named?.Identifier.ValueText });
    }

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));

    // ---- Each part has its own method ----

    // Each part is a base type with its own method. The base has no code, and the only other classes of the base type
    // are abstract classes in between, with no code either. Fields and properties do not count as code.
    static void ExpectOwnWork(Type @base, Type[] parts, string method)
    {
        foreach (var type in parts)
        {
            Expect.That(@base.IsAssignableFrom(type), "notAPart", new { type = type.Name });
            Expect.That(Declares(type, @base, method), "notItsOwn", new { type = type.Name });
        }

        var code = CodeIn(@base);
        Expect.That(code is null, "baseHasCode", new { member = code });

        foreach (var extra in CheckContext.Current.Assembly.GetTypes().Where(t =>
                     t != @base && @base.IsAssignableFrom(t) && !parts.Contains(t) && !t.Name.Contains('<')
                     && !t.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute))))
        {
            Expect.That(extra.IsAbstract, "extraPart", new { type = extra.Name });
            var inBetween = CodeIn(extra);
            Expect.That(inBetween is null, "betweenHasCode", new { type = extra.Name, member = inBetween });
        }
    }

    // The first method the type itself writes with a body, not counting property accessors; null when there is none.
    static string? CodeIn(Type type) =>
        type.GetMethods(BindingFlags.DeclaredOnly | BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(m => !m.IsAbstract && !m.IsSpecialName && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)))
            ?.Name;

    // The method is written in the class itself.
    static bool Declares(Type type, Type @base, string method)
    {
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType == type;
    }

    static string CalledName(InvocationExpressionSyntax call) => call.Expression switch
    {
        MemberAccessExpressionSyntax m => m.Name.Identifier.ValueText,
        MemberBindingExpressionSyntax b => b.Name.Identifier.ValueText,
        SimpleNameSyntax s => s.Identifier.ValueText,
        _ => "",
    };

    // The first piece of code that tests which class something is: is, as, a type pattern, typeof or nameof on one
    // of the named classes, or GetType() inside one of them; null when there is none.
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
            if (node is InvocationExpressionSyntax call)
            {
                if (CalledName(call) == "GetType" && call.ArgumentList.Arguments.Count == 0
                    && call.Ancestors().OfType<TypeDeclarationSyntax>().Any(d => names.Contains(d.Identifier.ValueText))) return call.ToString();
                if (call.Expression is IdentifierNameSyntax { Identifier.ValueText: "nameof" }
                    && call.ArgumentList.Arguments.Any(a => names.Contains(Name(a.Expression)))) return call.ToString();
                continue;
            }
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
