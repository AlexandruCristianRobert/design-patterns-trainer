using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SortingLineChecks
{
    // A machine for the Checks only: it counts the items that reach it and answers "counted".
    sealed class Counter : Sorter
    {
        public int Seen { get; private set; }

        public override string Sort(Item item)
        {
            Seen++;
            return "counted";
        }
    }

    // Links the machines in the order given, with SetNext, and returns the first one.
    static Sorter Line(params Sorter[] machines)
    {
        for (var i = 0; i + 1 < machines.Length; i++)
            machines[i].SetNext(machines[i + 1]);
        return machines[0];
    }

    static string Feed(Sorter first, string name, string material, int grams) =>
        new SortingLine(first).Feed(new Item(name, material, grams));

    [Check("each-item-reaches-its-bin")]
    static void EachItemReachesItsBin()
    {
        var can = Feed(Line(new Magnet(), new Blower(), new GlassEye()), "steel can", "metal", 60);
        Expect.That(can == "steel can goes to the metal bin", "wrongBin",
            new { item = "steel can (metal, 60 g)", expected = "steel can goes to the metal bin", actual = can });

        var napkin = Feed(Line(new Magnet(), new Blower(), new GlassEye()), "paper napkin", "paper", 3);
        Expect.That(napkin == "paper napkin goes to the light bin", "wrongBin",
            new { item = "paper napkin (paper, 3 g)", expected = "paper napkin goes to the light bin", actual = napkin });

        var jar = Feed(Line(new Magnet(), new Blower(), new GlassEye()), "jam jar", "glass", 200);
        Expect.That(jar == "jam jar goes to the glass bin", "wrongBin",
            new { item = "jam jar (glass, 200 g)", expected = "jam jar goes to the glass bin", actual = jar });
    }

    [Check("a-machine-that-takes-an-item-stops-it")]
    static void AMachineThatTakesAnItemStopsIt()
    {
        var afterBlower = new Counter();
        Feed(Line(new Blower(), afterBlower), "paper napkin", "paper", 3);
        var afterGlass = new Counter();
        Feed(Line(new GlassEye(), afterGlass), "jam jar", "glass", 200);
        Expect.That(afterBlower.Seen == 0 && afterGlass.Seen == 0, "passedAfterTaking",
            new { blower = afterBlower.Seen, glass = afterGlass.Seen });

        var heavy = Feed(Line(new Blower(), new Counter()), "steel can", "metal", 60);
        Expect.That(heavy == "counted", "blowerKeptIt", new { expected = "counted", actual = heavy });

        var notGlass = Feed(Line(new GlassEye(), new Counter()), "plastic tub", "plastic", 45);
        Expect.That(notGlass == "counted", "glassEyeKeptIt", new { expected = "counted", actual = notGlass });
    }

    [Check("order-on-the-belt-matters")]
    static void OrderOnTheBeltMatters()
    {
        var magnetFirst = Feed(Line(new Magnet(), new Blower()), "bottle cap", "metal", 4);
        var blowerFirst = Feed(Line(new Blower(), new Magnet()), "bottle cap", "metal", 4);
        Expect.That(magnetFirst == "bottle cap goes to the metal bin", "wrongFirstTaker",
            new { line = "Magnet, then Blower", expected = "bottle cap goes to the metal bin", actual = magnetFirst });
        Expect.That(blowerFirst == "bottle cap goes to the light bin", "wrongFirstTaker",
            new { line = "Blower, then Magnet", expected = "bottle cap goes to the light bin", actual = blowerFirst });

        var glassFirst = Feed(Line(new GlassEye(), new Blower()), "glass shard", "glass", 10);
        Expect.That(glassFirst == "glass shard goes to the glass bin", "wrongFirstTaker",
            new { line = "GlassEye, then Blower", expected = "glass shard goes to the glass bin", actual = glassFirst });

        var lastOfThree = Feed(Line(new GlassEye(), new Blower(), new Magnet()), "steel can", "metal", 60);
        Expect.That(lastOfThree == "steel can goes to the metal bin", "wrongFirstTaker",
            new { line = "GlassEye, then Blower, then Magnet", expected = "steel can goes to the metal bin", actual = lastOfThree });
    }

    [Check("leftovers-go-to-general-waste")]
    static void LeftoversGoToGeneralWaste()
    {
        var tub = Feed(Line(new Magnet(), new Blower(), new GlassEye()), "plastic tub", "plastic", 45);
        Expect.That(tub == "plastic tub goes to general waste", "wrongLeftover",
            new { item = "plastic tub (plastic, 45 g)", expected = "plastic tub goes to general waste", actual = tub });

        var tray = Feed(Line(new Magnet(), new Blower(), new GlassEye()), "egg tray", "paper", 30);
        Expect.That(tray == "egg tray goes to general waste", "wrongLeftover",
            new { item = "egg tray (paper, 30 g)", expected = "egg tray goes to general waste", actual = tray });

        var alone = Feed(new Blower(), "jam jar", "glass", 200);
        Expect.That(alone == "jam jar goes to general waste", "wrongLoneLeftover",
            new { expected = "jam jar goes to general waste", actual = alone });
    }

    [Check("machines-know-only-the-next")]
    static void MachinesKnowOnlyTheNext()
    {
        var link = typeof(Sorter);
        foreach (var type in new[] { typeof(Magnet), typeof(Blower), typeof(GlassEye) })
        {
            Expect.That(link.IsAssignableFrom(type), "notASorter", new { type = type.Name });
            Expect.That(FieldsOf(type).Any(f => !f.IsStatic && HoldsOne(f.FieldType, link)), "noNext", new { type = type.Name });
        }

        var held = FieldsOf(typeof(SortingLine)).Count(f => HoldsOne(f.FieldType, link));
        Expect.That(held == 1, "lineHoldsMore", new { held });

        foreach (var type in link.Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField))
                Expect.That(!HoldsMany(field.FieldType, link), "keptInACollection", new { type = type.Name, field = field.Name });

        var written = CollectionInSource(["Sorter", "Magnet", "Blower", "GlassEye"]);
        Expect.That(written is null, "collectionInCode", new { written });

        var loop = LoopCalling("Sort");
        Expect.That(loop is null, "loopCallsEach", new { loop });
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

    // A field of this type can hold one link.
    static bool HoldsOne(Type fieldType, Type link) => fieldType != typeof(object) && fieldType.IsAssignableFrom(link);

    // A field of this type holds many links: an array or a collection of them.
    static bool HoldsMany(Type fieldType, Type link)
    {
        bool IsLink(Type t) => t != typeof(object) && (t.IsAssignableFrom(link) || link.IsAssignableFrom(t));
        if (fieldType.IsArray) return IsLink(fieldType.GetElementType()!);
        return fieldType.GetInterfaces().Append(fieldType)
            .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>))
            .Any(i => IsLink(i.GetGenericArguments()[0]));
    }

    // The first type written in the code that collects links, such as List<Sorter> or Sorter[]; null when there is none.
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
}
