using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SchoolSportsDayChecks
{
    const string ReportName = "IResultVisitor";
    const string HandOver = "Accept";
    static readonly string[] Classes = ["Sprint", "LongJump", "Relay"];
    static readonly string[] Reports = ["HousePoints", "CertificateList"];

    [Check("points-follow-each-event")]
    static void PointsFollowEachEvent()
    {
        (string Results, List<IResult> Made, int Points)[] cases =
        [
            ("a sprint won", [new Sprint("Ana", 1)], 5),
            ("sprints in places 2, 3 and 4", [new Sprint("Ana", 2), new Sprint("Ben", 3), new Sprint("Cleo", 4)], 4),
            ("a long jump of 349 cm", [new LongJump("Ben", 349)], 6),
            ("relays in places 1, 2 and 3", [new Relay("Red", 1), new Relay("Blue", 2), new Relay("Green", 3)], 18),
            ("no result", [], 0),
            ("a relay in place 5, a long jump of 40 cm, a sprint in place 3 and a relay in place 2", [new Relay("Red", 5), new LongJump("Dan", 40), new Sprint("Eva", 3), new Relay("Blue", 2)], 7),
        ];
        foreach (var (results, made, points) in cases)
        {
            var actual = new SportsDay(made).Points();
            Expect.That(actual == points, "wrongPoints", new { results, expected = points, actual });
        }
    }

    [Check("certificates-only-for-the-best")]
    static void CertificatesOnlyForTheBest()
    {
        var day = new SportsDay([new Sprint("Ana", 1), new LongJump("Ben", 310), new Relay("Red", 2), new Sprint("Cleo", 4), new LongJump("Dan", 299), new Relay("Blue", 1), new LongJump("Eva", 300)]);
        const string expected = "Ana: sprint winner | Ben: long jump, 310 cm | Blue: relay winners | Eva: long jump, 300 cm";
        var actual = string.Join(" | ", day.Certificates());
        Expect.That(actual == expected, "wrongCertificates", new { expected, actual });
        var none = new SportsDay([new Sprint("Fay", 2), new Relay("Green", 3)]).Certificates().Count;
        Expect.That(none == 0, "certificatesForNobody", new { expected = 0, actual = none });
    }

    [Check("one-visit-per-result-class")]
    static void OneVisitPerResultClass() => ExpectOneMethodPerClass();

    [Check("each-result-has-its-own-accept")]
    static void EachResultHasItsOwnAccept() => ExpectOwnHandOver();

    [Check("results-keep-no-report-rules")]
    static void ResultsKeepNoReportRules() => ExpectNoOtherMethods();

    [Check("nothing-tests-the-kind-of-result")]
    static void NothingTestsTheKindOfResult() => ExpectNoTypeTests();

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
