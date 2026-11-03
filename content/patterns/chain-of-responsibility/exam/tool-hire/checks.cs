using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ToolHireChecks
{
    [Check("nearest-place-with-the-tool")]
    static void NearestPlaceWithTheTool()
    {
        var ladder = new HireCounter().Ask("ladder");
        Expect.That(ladder == "ladder from the town shop, ready now", "wrongPlace",
            new { tool = "ladder", expected = "ladder from the town shop, ready now", actual = ladder });

        var sander = new HireCounter().Ask("floor sander");
        Expect.That(sander == "floor sander from the depot, ready tomorrow", "wrongPlace",
            new { tool = "floor sander", expected = "floor sander from the depot, ready tomorrow", actual = sander });

        var mixer = new HireCounter().Ask("cement mixer");
        Expect.That(mixer == "cement mixer from the partner shop, ready in 3 days", "wrongPlace",
            new { tool = "cement mixer", expected = "cement mixer from the partner shop, ready in 3 days", actual = mixer });

        var drill = new HireCounter().Ask("drill");
        Expect.That(drill == "drill from the town shop, ready now", "wrongPlace",
            new { tool = "drill", expected = "drill from the town shop, ready now", actual = drill });
    }

    [Check("hired-tools-are-gone")]
    static void HiredToolsAreGone()
    {
        var counter = new HireCounter();
        var drills = string.Join(" / ", counter.Ask("drill"), counter.Ask("drill"), counter.Ask("drill"), counter.Ask("drill"));
        const string expected = "drill from the town shop, ready now / drill from the depot, ready tomorrow / drill from the partner shop, ready in 3 days / No drill free anywhere";
        Expect.That(drills == expected, "wrongDrills", new { expected, actual = drills });

        var ladders = string.Join(" / ", counter.Ask("ladder"), counter.Ask("ladder"));
        const string expectedLadders = "ladder from the town shop, ready now / No ladder free anywhere";
        Expect.That(ladders == expectedLadders, "wrongLadders", new { expected = expectedLadders, actual = ladders });
    }

    [Check("unknown-tools-are-not-free-anywhere")]
    static void UnknownToolsAreNotFreeAnywhere()
    {
        var counter = new HireCounter();
        var hammer = counter.Ask("jackhammer");
        Expect.That(hammer == "No jackhammer free anywhere", "wrongUnknown",
            new { expected = "No jackhammer free anywhere", actual = hammer });

        var cutter = counter.Ask("tile cutter");
        Expect.That(cutter == "tile cutter from the depot, ready tomorrow", "unknownTookStock",
            new { expected = "tile cutter from the depot, ready tomorrow", actual = cutter });
    }

    [Check("each-counter-has-its-own-stock")]
    static void EachCounterHasItsOwnStock()
    {
        var first = new HireCounter();
        first.Ask("drill");
        first.Ask("ladder");
        var second = new HireCounter().Ask("drill");
        Expect.That(second == "drill from the town shop, ready now", "sharedStock",
            new { expected = "drill from the town shop, ready now", actual = second });
    }

    [Check("places-know-only-the-next")]
    static void PlacesKnowOnlyTheNext()
    {
        var link = typeof(Branch);
        foreach (var type in new[] { typeof(TownShop), typeof(Depot), typeof(PartnerShop) })
        {
            Expect.That(link.IsAssignableFrom(type), "notABranch", new { type = type.Name });
            Expect.That(FieldsOf(type).Any(f => !f.IsStatic && HoldsOne(f.FieldType, link)), "noNext", new { type = type.Name });
        }

        var held = FieldsOf(typeof(HireCounter)).Count(f => HoldsOne(f.FieldType, link));
        Expect.That(held == 1, "counterHoldsMore", new { held });

        foreach (var type in link.Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField))
                Expect.That(!HoldsMany(field.FieldType, link), "keptInACollection", new { type = type.Name, field = field.Name });

        var written = CollectionInSource(["Branch", "TownShop", "Depot", "PartnerShop"]);
        Expect.That(written is null, "collectionInCode", new { written });

        var loop = LoopCalling("Hire");
        Expect.That(loop is null, "loopCallsEach", new { loop });
    }

    [Check("each-place-hands-on-to-its-next")]
    static void EachPlaceHandsOnToItsNext()
    {
        var link = typeof(Branch);
        string Hire(string tool, params string[] line) => ((Branch)LineOf(link, line)).Hire(tool);

        var a = Hire("cement mixer", "TownShop", "PartnerShop");
        Expect.That(a == "cement mixer from the partner shop, ready in 3 days", "wrongLine",
            new { line = "TownShop, then PartnerShop", tool = "cement mixer", expected = "cement mixer from the partner shop, ready in 3 days", actual = a });

        var b = Hire("ladder", "PartnerShop", "TownShop");
        Expect.That(b == "ladder from the town shop, ready now", "wrongLine",
            new { line = "PartnerShop, then TownShop", tool = "ladder", expected = "ladder from the town shop, ready now", actual = b });

        var c = Hire("ladder", "Depot", "TownShop");
        Expect.That(c == "ladder from the town shop, ready now", "wrongLine",
            new { line = "Depot, then TownShop", tool = "ladder", expected = "ladder from the town shop, ready now", actual = c });

        var d = Hire("ladder", "Depot");
        Expect.That(d == "No ladder free anywhere", "wrongLine",
            new { line = "Depot on its own", tool = "ladder", expected = "No ladder free anywhere", actual = d });
    }

    // ---- Who holds which link ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every field of a type: its own and the ones it inherits, private ones included.
    static IEnumerable<FieldInfo> FieldsOf(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var field in t.GetFields(AnyField))
                yield return field;
    }

    // A field of this type holds one link: the link type itself, a wider type, or one kind of link (never object).
    static bool HoldsOne(Type fieldType, Type link) =>
        fieldType != typeof(object) && (fieldType.IsAssignableFrom(link) || link.IsAssignableFrom(fieldType));

    // A field of this type holds many links: an array or a collection of them.
    static bool HoldsMany(Type fieldType, Type link)
    {
        bool IsLink(Type t) => t != typeof(object) && (t.IsAssignableFrom(link) || link.IsAssignableFrom(t));
        if (fieldType.IsArray) return IsLink(fieldType.GetElementType()!);
        return fieldType.GetInterfaces().Append(fieldType)
            .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>))
            .Any(i => IsLink(i.GetGenericArguments()[0]));
    }

    // The first type written in the code that collects links, such as List<Branch> or Branch[]; null when there is none.
    static string? CollectionInSource(string[] names)
    {
        bool Mentions(SyntaxNode node) =>
            node.DescendantNodesAndSelf().OfType<IdentifierNameSyntax>().Any(n => names.Contains(n.Identifier.ValueText));
        foreach (var node in Source.Root.DescendantNodes())
        {
            if (node is GenericNameSyntax generic && generic.TypeArgumentList.Arguments.Any(Mentions)) return generic.ToString();
            if (node is ArrayTypeSyntax array && Mentions(array.ElementType)) return array.ToString();
        }
        return null;
    }

    // The first loop or lambda inside a class that calls the given method, such as a foreach over the links; null when there is none.
    static string? LoopCalling(string method)
    {
        bool Calls(SyntaxNode node) => node.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(i =>
            i.Expression is MemberAccessExpressionSyntax access && access.Name.Identifier.ValueText == method
            || i.Expression is MemberBindingExpressionSyntax binding && binding.Name.Identifier.ValueText == method);
        var loop = Source.Root.DescendantNodes().Where(n => n.Ancestors().OfType<TypeDeclarationSyntax>().Any()).FirstOrDefault(n =>
            n is ForEachStatementSyntax or ForStatementSyntax or WhileStatementSyntax or DoStatementSyntax or LambdaExpressionSyntax && Calls(n));
        return loop?.ToString().Split('\n')[0].Trim();
    }

    // A new link of this type, joined to the next one the way the code allows: a public constructor that takes
    // the next link (null when there is none), or a public constructor without parameters and a public method that takes it.
    static object Make(Type type, Type link, object? next)
    {
        bool TakesLink(ParameterInfo[] ps) => ps is [var p] && p.ParameterType != typeof(object) && p.ParameterType.IsAssignableFrom(link);

        var withNext = type.GetConstructors().FirstOrDefault(c => TakesLink(c.GetParameters()));
        if (withNext is not null) return withNext.Invoke([next]);

        var bare = type.GetConstructor(Type.EmptyTypes);
        if (bare is null) Expect.Fail("cannotLink", new { type = type.Name });
        var made = bare.Invoke([]);
        if (next is null) return made;

        var setter = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => TakesLink(m.GetParameters()));
        if (setter is null) Expect.Fail("cannotLink", new { type = type.Name });
        setter.Invoke(made, [next]);
        return made;
    }

    // A line of the named types, in this order; returns the first one.
    static object LineOf(Type link, params string[] names)
    {
        object? next = null;
        for (var i = names.Length - 1; i >= 0; i--)
            next = Make(Code.Type(names[i]).Clr, link, next);
        return next!;
    }
}
