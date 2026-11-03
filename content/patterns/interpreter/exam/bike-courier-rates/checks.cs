using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BikeCourierChecks
{
    // Four deliveries, each with the words the failure messages use for it.
    static readonly (Delivery Delivery, string Said)[] Deliveries =
    [
        (new Delivery(3, 1, false), "3 km, 1 stop, no rush"),
        (new Delivery(12, 2, true), "12 km, 2 stops, in a rush"),
        (new Delivery(7, 4, false), "7 km, 4 stops, no rush"),
        (new Delivery(20, 1, true), "20 km, 1 stop, in a rush"),
    ];

    // Prices the rate for each of the four deliveries.
    static void Try(Rate rate, string written, int[] expected)
    {
        for (var i = 0; i < Deliveries.Length; i++)
        {
            var actual = rate.Price(Deliveries[i].Delivery);
            Expect.That(actual == expected[i], "wrongPrice", new { rate = written, delivery = Deliveries[i].Said, expected = expected[i], actual });
        }
    }

    [Check("simple-parts-price-a-delivery")]
    static void SimplePartsPriceADelivery()
    {
        Try(new Euros(9), "Euros(9)", [9, 9, 9, 9]);
        Try(new Distance(), "Distance()", [3, 12, 7, 20]);
        Try(new StopCount(), "StopCount()", [1, 2, 4, 1]);
    }

    [Check("joining-parts-ask-the-parts-they-hold")]
    static void JoiningPartsAskThePartsTheyHold()
    {
        Try(new Sum(new Distance(), new StopCount()), "Sum(Distance(), StopCount())", [4, 14, 11, 21]);
        Try(new Times(new Euros(2), new Distance()), "Times(Euros(2), Distance())", [6, 24, 14, 40]);
        Try(new AtLeast(10, new Distance()), "AtLeast(10, Distance())", [10, 12, 10, 20]);
        Try(new RushOr(new Euros(15), new Euros(5)), "RushOr(Euros(15), Euros(5))", [5, 15, 5, 15]);
    }

    [Check("nested-rates-price-every-delivery")]
    static void NestedRatesPriceEveryDelivery()
    {
        Try(new AtLeast(8, new Sum(new Times(new Euros(2), new Distance()), new RushOr(new Euros(10), new Euros(0)))),
            "AtLeast(8, Sum(Times(Euros(2), Distance()), RushOr(Euros(10), Euros(0))))", [8, 34, 14, 50]);
        Try(new RushOr(new Times(new Sum(new Distance(), new StopCount()), new Euros(3)),
                new Sum(new Euros(4), new Times(new StopCount(), new AtLeast(2, new Euros(1))))),
            "RushOr(Times(Sum(Distance(), StopCount()), Euros(3)), Sum(Euros(4), Times(StopCount(), AtLeast(2, Euros(1)))))", [6, 42, 12, 63]);
    }

    [Check("an-account-quotes-with-its-rate")]
    static void AnAccountQuotesWithItsRate()
    {
        var account = new CourierAccount("Rosa's Bakery",
            new AtLeast(8, new Sum(new Times(new Euros(2), new Distance()), new RushOr(new Euros(10), new Euros(0)))));
        var first = account.Quote(Deliveries[1].Delivery);
        Expect.That(first == "Rosa's Bakery: 34 euros", "wrongQuote",
            new { moment = "With its first price list", expected = "Rosa's Bakery: 34 euros", actual = first });

        account.SetRate(new Sum(new Euros(4), new Times(new StopCount(), new Euros(2))));
        var second = account.Quote(Deliveries[1].Delivery);
        Expect.That(second == "Rosa's Bakery: 8 euros", "wrongQuote",
            new { moment = "After SetRate", expected = "Rosa's Bakery: 8 euros", actual = second });
    }

    [Check("each-part-prices-itself")]
    static void EachPartPricesItself()
    {
        var parts = new[] { typeof(Euros), typeof(Distance), typeof(StopCount), typeof(Sum), typeof(Times), typeof(AtLeast), typeof(RushOr) };
        ExpectOwnWork(typeof(Rate), parts, "Price", ["Delivery"]);

        var names = parts.Select(t => t.Name).ToArray();
        var test = TypeTest(names);
        Expect.That(test is null, "typeTest", new { code = test });

        foreach (var field in typeof(CourierAccount).GetFields(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic))
            foreach (var concrete in parts)
                Expect.That(!Involves(field.FieldType, concrete), "accountHoldsConcrete", new { field = field.Name, type = concrete.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "CourierAccount")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => names.Contains(n.Identifier.ValueText));
        Expect.That(named is null, "accountNamesConcrete", new { type = named?.Identifier.ValueText });
    }

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));

    // ---- Each part does all of its own work ----

    // Each part is a base type with its own method; the base has no code; no other class is a base type;
    // and no part calls a method written outside the parts, the base and the input types.
    static void ExpectOwnWork(Type @base, Type[] parts, string method, string[] inputs)
    {
        foreach (var type in parts)
        {
            Expect.That(@base.IsAssignableFrom(type), "notAPart", new { type = type.Name });
            Expect.That(Declares(type, @base, method), "notItsOwn", new { type = type.Name });
        }

        var code = @base.GetMethods(BindingFlags.DeclaredOnly | BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(m => !m.IsAbstract && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)));
        Expect.That(code is null, "baseHasCode", new { member = code?.Name });

        var extra = CheckContext.Current.Assembly.GetTypes().FirstOrDefault(t =>
            t != @base && @base.IsAssignableFrom(t) && !parts.Contains(t) && !t.Name.Contains('<')
            && !t.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)));
        Expect.That(extra is null, "extraPart", new { type = extra?.Name });

        var partNames = parts.Select(p => p.Name).ToHashSet();
        var allowed = partNames.Append(@base.Name).Concat(inputs).ToHashSet();
        var declarations = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().ToList();
        var outside = declarations.Where(d => !allowed.Contains(d.Identifier.ValueText))
            .SelectMany(d => d.Members.OfType<MethodDeclarationSyntax>()).Select(m => m.Identifier.ValueText).ToHashSet();
        var call = declarations.Where(d => partNames.Contains(d.Identifier.ValueText)).SelectMany(d => d.DescendantNodes())
            .FirstOrDefault(n => n is BaseExpressionSyntax || n is InvocationExpressionSyntax i && outside.Contains(CalledName(i)));
        Expect.That(call is null, "callsOutside", new { code = (call is BaseExpressionSyntax ? call.Parent : call)?.ToString() });
    }

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
    // of the named classes, or any GetType(); null when there is none.
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
                if (CalledName(call) == "GetType" && call.ArgumentList.Arguments.Count == 0) return call.ToString();
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
