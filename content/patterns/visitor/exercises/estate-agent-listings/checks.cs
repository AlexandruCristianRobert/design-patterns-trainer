using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class EstateAgentListingsChecks
{
    const string ReportName = "IListingVisitor";
    const string HandOver = "Accept";
    static readonly string[] Classes = ["Flat", "House", "Plot"];
    static readonly string[] Reports = ["MonthlyFees", "WindowCards"];

    [Check("fees-follow-each-listing")]
    static void FeesFollowEachListing()
    {
        (string Listings, List<IListing> Made, int Fees)[] cases =
        [
            ("a 3-room flat", [new Flat(3, 2, true)], 60),
            ("a 4-room house with a 125 m² garden", [new House(4, 125)], 132),
            ("a 2-room house with no garden", [new House(2, 0)], 60),
            ("a plot of 800 m²", [new Plot(800)], 50),
            ("no listing", [], 0),
            ("a plot of 300 m², a 1-room flat, a 5-room house with a 49 m² garden and a plot of 2000 m²", [new Plot(300), new Flat(1, 0, false), new House(5, 49), new Plot(2000)], 274),
        ];
        foreach (var (listings, made, fees) in cases)
        {
            var actual = new Agency(made).Fees();
            Expect.That(actual == fees, "wrongFees", new { listings, expected = fees, actual });
        }
    }

    [Check("window-cards-describe-each-listing")]
    static void WindowCardsDescribeEachListing()
    {
        var agency = new Agency([new Flat(3, 2, true), new House(4, 120), new Plot(800), new Flat(1, 0, false), new House(6, 0)]);
        const string expected = "3-room flat, floor 2, lift | 4-room house, 120 m² garden | building plot, 800 m² | 1-room flat, ground floor, no lift | 6-room house, no garden";
        var actual = string.Join(" | ", agency.Cards());
        Expect.That(actual == expected, "wrongCards", new { expected, actual });
        var none = new Agency([]).Cards().Count;
        Expect.That(none == 0, "cardsWithoutListings", new { expected = 0, actual = none });
    }

    [Check("one-visit-per-listing-class")]
    static void OneVisitPerListingClass() => ExpectOneMethodPerClass();

    [Check("each-listing-has-its-own-accept")]
    static void EachListingHasItsOwnAccept() => ExpectOwnHandOver();

    [Check("listings-keep-no-report-rules")]
    static void ListingsKeepNoReportRules() => ExpectNoOtherMethods();

    [Check("nothing-tests-the-kind-of-listing")]
    static void NothingTestsTheKindOfListing() => ExpectNoTypeTests();

    // ---- Each class of the structure hands itself to the report, which has one method per class ----

    const BindingFlags Declared =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static Type[] OurTypes => CheckContext.Current.Assembly.GetTypes();

    // The type with this name, generic or not.
    static Type Named(string name)
    {
        var type = OurTypes.FirstOrDefault(t => t.Name == name || t.Name.StartsWith(name + "`"));
        if (type is null) Expect.Fail("typeNotFound", new { type = name });
        return type;
    }

    // The report type: named with the I, or without it when it is a class.
    static Type ReportType()
    {
        var type = OurTypes.FirstOrDefault(t => Shown(t) == ReportName || Shown(t) == ReportName[1..]);
        if (type is null) Expect.Fail("typeNotFound", new { type = ReportName });
        return type;
    }

    // The name as written, without the `1 of a generic type.
    static string Shown(Type type) => type.Name.Contains('`') ? type.Name[..type.Name.IndexOf('`')] : type.Name;

    // The type itself, its base classes and its interfaces.
    static IEnumerable<Type> Supertypes(Type type)
    {
        for (var b = type; b is not null; b = b.BaseType) yield return b;
        foreach (var i in type.GetInterfaces()) yield return i;
    }

    // The type is the report type, for any T when the report type is generic.
    static bool IsReport(Type type, Type report) =>
        Supertypes(type).Any(s => s == report || s.IsGenericType && s.GetGenericTypeDefinition() == report);

    // The report type has exactly one method that takes each class, and each named report is one.
    static void ExpectOneMethodPerClass()
    {
        var report = ReportType();
        var methods = Supertypes(report).Where(s => s.Assembly == report.Assembly)
            .SelectMany(s => s.GetMethods(Declared)).Where(m => !m.IsStatic).ToList();
        foreach (var name in Classes)
        {
            var type = Named(name);
            var count = methods.Count(m => m.GetParameters() is [var p] && p.ParameterType == type);
            Expect.That(count > 0, "noMethodFor", new { report = Shown(report), type = name });
            Expect.That(count == 1, "twoMethodsFor", new { report = Shown(report), type = name, count });
        }
        foreach (var name in Reports)
            Expect.That(IsReport(Named(name), report), "notAReport", new { type = name, report = Shown(report) });
    }

    // Each class declares its own hand-over method, taking the report type.
    static void ExpectOwnHandOver()
    {
        var report = ReportType();
        foreach (var name in Classes)
        {
            var own = Named(name).GetMethods(Declared).Any(m =>
                (m.Name == HandOver || m.Name.EndsWith("." + HandOver)) && !m.IsStatic && !m.IsAbstract
                && m.GetParameters() is [var p] && (p.ParameterType == report
                    || p.ParameterType.IsGenericType && p.ParameterType.GetGenericTypeDefinition() == report));
            Expect.That(own, "noHandOver", new { type = name, report = Shown(report) });
        }
    }

    // The classes, and the types of ours they are, have no methods with code other than the hand-over method.
    static void ExpectNoOtherMethods()
    {
        foreach (var name in Classes)
            foreach (var type in Supertypes(Named(name)).Where(s => s.Assembly == CheckContext.Current.Assembly))
            {
                var other = type.GetMethods(Declared).FirstOrDefault(m =>
                    !m.IsAbstract && !m.IsSpecialName && !m.Name.StartsWith('<')
                    && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute))
                    && m.Name != HandOver && !m.Name.EndsWith("." + HandOver));
                Expect.That(other is null, "otherMethod", new { type = Shown(type), method = other?.Name });
            }
    }

    // No code tests which class something is: no is, as, type pattern, case, typeof or nameof names one of the
    // classes or one of the report classes, and no code calls GetType().
    static void ExpectNoTypeTests()
    {
        var report = OurTypes.FirstOrDefault(t => Shown(t) == ReportName || Shown(t) == ReportName[1..]);
        var names = Classes.Concat(report is null ? [] : OurTypes.Where(t => t != report && IsReport(t, report)).Select(Shown)).ToHashSet();

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
                var called = call.Expression switch
                {
                    MemberAccessExpressionSyntax m => m.Name.Identifier.ValueText,
                    MemberBindingExpressionSyntax b => b.Name.Identifier.ValueText,
                    SimpleNameSyntax s => s.Identifier.ValueText,
                    _ => "",
                };
                var found = called == "GetType" && call.ArgumentList.Arguments.Count == 0
                    || called == "nameof" && call.ArgumentList.Arguments.Any(a => names.Contains(Name(a.Expression)));
                Expect.That(!found, "typeTest", new { code = call.ToString() });
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
            if (named is null || !names.Contains(Name(named))) continue;
            var shown = node.AncestorsAndSelf().FirstOrDefault(a => a is IsPatternExpressionSyntax or SwitchExpressionArmSyntax or SwitchLabelSyntax) ?? node;
            Expect.Fail("typeTest", new { code = shown.ToString().Split('\n')[0].Trim() });
        }
    }
}
