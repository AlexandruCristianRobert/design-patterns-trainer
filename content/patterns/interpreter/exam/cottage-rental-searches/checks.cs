using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class CottageSearchChecks
{
    static Cottage[] Cottages() =>
    [
        new Cottage("Heron Lodge", 6, 180, ["hot tub", "garden", "dogs welcome"]),
        new Cottage("Moss Hut", 2, 70, ["dogs welcome"]),
        new Cottage("Old Mill", 8, 240, ["garden", "sauna"]),
        new Cottage("Bay View", 4, 120, ["sea view", "hot tub"]),
        new Cottage("Fern Barn", 4, 95, ["garden"]),
    ];

    // Asks the search about each of the five cottages and compares the names of those that match.
    static void Try(Search search, string written, string expected)
    {
        var names = Cottages().Where(c => search.Matches(c)).Select(c => c.Name).ToList();
        var actual = names.Count == 0 ? "none" : string.Join(", ", names);
        Expect.That(actual == expected, "wrongCottages", new { search = written, expected, actual });
    }

    [Check("simple-searches-match-the-right-cottages")]
    static void SimpleSearchesMatchTheRightCottages()
    {
        Try(new SleepsAtLeast(4), "SleepsAtLeast(4)", "Heron Lodge, Old Mill, Bay View, Fern Barn");
        Try(new SleepsAtLeast(8), "SleepsAtLeast(8)", "Old Mill");
        Try(new CostsAtMost(120), "CostsAtMost(120)", "Moss Hut, Bay View, Fern Barn");
        Try(new WithFeature("garden"), "WithFeature(\"garden\")", "Heron Lodge, Old Mill, Fern Barn");
        Try(new WithFeature("pool"), "WithFeature(\"pool\")", "none");
    }

    [Check("joining-searches-ask-the-searches-they-hold")]
    static void JoiningSearchesAskTheSearchesTheyHold()
    {
        Try(new And(new SleepsAtLeast(4), new CostsAtMost(120)), "And(SleepsAtLeast(4), CostsAtMost(120))", "Bay View, Fern Barn");
        Try(new Or(new WithFeature("sauna"), new WithFeature("sea view")), "Or(WithFeature(\"sauna\"), WithFeature(\"sea view\"))", "Old Mill, Bay View");
        Try(new Not(new WithFeature("garden")), "Not(WithFeature(\"garden\"))", "Moss Hut, Bay View");
    }

    [Check("nested-searches-match-the-right-cottages")]
    static void NestedSearchesMatchTheRightCottages()
    {
        Try(new And(new WithFeature("garden"), new Or(new CostsAtMost(100), new Not(new SleepsAtLeast(7)))),
            "And(WithFeature(\"garden\"), Or(CostsAtMost(100), Not(SleepsAtLeast(7))))", "Heron Lodge, Fern Barn");
        Try(new Or(new And(new WithFeature("dogs welcome"), new Not(new SleepsAtLeast(3))), new And(new WithFeature("hot tub"), new CostsAtMost(150))),
            "Or(And(WithFeature(\"dogs welcome\"), Not(SleepsAtLeast(3))), And(WithFeature(\"hot tub\"), CostsAtMost(150)))", "Moss Hut, Bay View");
        Try(new Not(new Or(new WithFeature("hot tub"), new And(new SleepsAtLeast(5), new Not(new WithFeature("sauna"))))),
            "Not(Or(WithFeature(\"hot tub\"), And(SleepsAtLeast(5), Not(WithFeature(\"sauna\")))))", "Moss Hut, Old Mill, Fern Barn");
    }

    [Check("the-listing-finds-in-listed-order")]
    static void TheListingFindsInListedOrder()
    {
        var listing = new Listing(Cottages());
        var cheap = listing.Find(new CostsAtMost(150));
        Expect.That(cheap == "Moss Hut, Bay View, Fern Barn", "wrongFind",
            new { search = "CostsAtMost(150)", expected = "Moss Hut, Bay View, Fern Barn", actual = cheap });
        var nothing = listing.Find(new And(new SleepsAtLeast(8), new WithFeature("hot tub")));
        Expect.That(nothing == "none", "wrongFind",
            new { search = "And(SleepsAtLeast(8), WithFeature(\"hot tub\"))", expected = "none", actual = nothing });
    }

    [Check("each-part-matches-by-itself")]
    static void EachPartMatchesByItself()
    {
        var parts = new[] { typeof(SleepsAtLeast), typeof(CostsAtMost), typeof(WithFeature), typeof(And), typeof(Or), typeof(Not) };
        foreach (var type in parts)
            Expect.That(WorksItOut(type, typeof(Search), "Matches"), "notItsOwnMatch", new { type = type.Name });

        var names = parts.Select(t => t.Name).ToArray();
        var test = TypeTest(names);
        Expect.That(test is null, "typeTest", new { code = test });

        foreach (var field in typeof(Listing).GetFields(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic))
            foreach (var concrete in parts)
                Expect.That(!Involves(field.FieldType, concrete), "listingHoldsConcrete", new { field = field.Name, type = concrete.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "Listing")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => names.Contains(n.Identifier.ValueText));
        Expect.That(named is null, "listingNamesConcrete", new { type = named?.Identifier.ValueText });
    }

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));

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
