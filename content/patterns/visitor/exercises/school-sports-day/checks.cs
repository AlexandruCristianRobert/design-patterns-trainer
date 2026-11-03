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

    // The report types: the one named with the I and the one named without it, whichever exist.
    static Type[] ReportTypes() =>
        new[] { ReportName, ReportName[1..] }
            .Select(n => OurTypes.FirstOrDefault(t => Shown(t) == n && !t.IsNested && !t.Name.Contains('<')))
            .OfType<Type>().ToArray();

    // The report type the checks count methods on: the I-named one when both exist, so the order of the code does not matter.
    static Type ReportType()
    {
        var types = ReportTypes();
        if (types.Length == 0) Expect.Fail("typeNotFound", new { type = ReportName });
        return types[0];
    }

    // The name as written, without the `1 of a generic type.
    static string Shown(Type type) => type.Name.Contains('`') ? type.Name[..type.Name.IndexOf('`')] : type.Name;

    // The type itself, its base classes and its interfaces.
    static IEnumerable<Type> Supertypes(Type type)
    {
        for (var b = type; b is not null; b = b.BaseType) yield return b;
        foreach (var i in type.GetInterfaces()) yield return i;
    }

    static Type Open(Type type) => type.IsGenericType ? type.GetGenericTypeDefinition() : type;

    // The type is one of the report types, for any T when a report type is generic.
    static bool IsReport(Type type, Type[] reports) => Supertypes(type).Any(s => reports.Contains(Open(s)));

    // The instance methods of the report type and of the types of ours it is, each counted once: a class method that
    // implements one of these interface methods stands for it.
    static List<MethodInfo> ReportMethods(Type report)
    {
        var ours = Supertypes(report).Where(s => s.Assembly == report.Assembly).Distinct().ToList();
        var classMethods = ours.Where(s => !s.IsInterface).SelectMany(s => s.GetMethods(Declared)).Where(m => !m.IsStatic).ToList();
        var implemented = new HashSet<MethodInfo>();
        if (!report.IsInterface)
            foreach (var i in report.GetInterfaces().Where(i => i.Assembly == report.Assembly))
                implemented.UnionWith(report.GetInterfaceMap(i).InterfaceMethods);
        var interfaceMethods = ours.Where(s => s.IsInterface).SelectMany(s => s.GetMethods(Declared))
            .Where(m => !m.IsStatic && !implemented.Contains(m));
        return classMethods.Concat(interfaceMethods).ToList();
    }

    // The report type has exactly one method that takes each class, and each named report is one.
    static void ExpectOneMethodPerClass()
    {
        var report = ReportType();
        var methods = ReportMethods(report);
        foreach (var name in Classes)
        {
            var type = Named(name);
            var count = methods.Count(m => m.GetParameters() is [var p] && p.ParameterType == type);
            Expect.That(count > 0, "noMethodFor", new { report = Shown(report), type = name });
            Expect.That(count == 1, "twoMethodsFor", new { report = Shown(report), type = name, count });
        }
        foreach (var name in Reports)
            Expect.That(IsReport(Named(name), ReportTypes()), "notAReport", new { type = name, report = Shown(report) });
    }

    // Each class declares its own hand-over method, taking one of the report types.
    static void ExpectOwnHandOver()
    {
        var report = ReportType();
        var reports = ReportTypes();
        foreach (var name in Classes)
        {
            var own = Named(name).GetMethods(Declared).Any(m =>
                (m.Name == HandOver || m.Name.EndsWith("." + HandOver)) && !m.IsStatic && !m.IsAbstract
                && m.GetParameters() is [var p] && reports.Contains(Open(p.ParameterType)));
            Expect.That(own, "noHandOver", new { type = name, report = Shown(report) });
        }
    }

    // The classes, and the types of ours they are, have no instance methods of their own with code other than the
    // hand-over method. Overrides of object's methods (ToString, Equals, GetHashCode), methods of .NET interfaces
    // such as IEquatable<T>, Deconstruct, a record's PrintMembers, static methods and generated code do not count.
    static void ExpectNoOtherMethods()
    {
        foreach (var name in Classes)
            foreach (var type in Supertypes(Named(name)).Where(s => s.Assembly == CheckContext.Current.Assembly))
            {
                var outside = new HashSet<MethodInfo>();
                if (!type.IsInterface)
                    foreach (var i in type.GetInterfaces().Where(i => i.Assembly != type.Assembly))
                        outside.UnionWith(type.GetInterfaceMap(i).TargetMethods);
                var other = type.GetMethods(Declared).FirstOrDefault(m =>
                    !m.IsStatic && !m.IsAbstract && !m.IsSpecialName && !m.Name.StartsWith('<')
                    && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute))
                    && m.GetBaseDefinition().DeclaringType != typeof(object) && !outside.Contains(m)
                    && m.Name is not ("Deconstruct" or "PrintMembers")
                    && m.Name != HandOver && !m.Name.EndsWith("." + HandOver));
                Expect.That(other is null, "otherMethod", new { type = Shown(type), method = other?.Name });
            }
    }

    // No method or property of the classes, or of the types of ours they are, has one of these names.
    static void ExpectNoMembersNamed(string[] names)
    {
        foreach (var name in Classes)
            foreach (var type in Supertypes(Named(name)).Where(s => s.Assembly == CheckContext.Current.Assembly))
            {
                var kept = type.GetMembers(Declared).FirstOrDefault(m =>
                    m.MemberType is MemberTypes.Method or MemberTypes.Property
                    && names.Any(n => m.Name == n || m.Name.EndsWith("." + n)));
                Expect.That(kept is null, "keptMember", new { type = Shown(type), member = kept?.Name });
            }
    }

    // Outside Equals methods and == / != operators, no code tests which class something is: no is, as, type pattern,
    // case, typeof or nameof names one of the classes or report classes, and no code compares GetType().
    static void ExpectNoTypeTests()
    {
        var reports = ReportTypes();
        var names = Classes.Concat(OurTypes.Where(t => !reports.Contains(t) && IsReport(t, reports)).Select(Shown)).ToHashSet();

        static string Name(SyntaxNode? n) => n switch
        {
            QualifiedNameSyntax q => q.Right.Identifier.ValueText,
            SimpleNameSyntax s => s.Identifier.ValueText,
            _ => "",
        };

        // GetType() used to decide something: compared with == or !=, tested with is or as, or switched on,
        // also through a chain such as GetType().Name.
        static bool Compared(InvocationExpressionSyntax call)
        {
            SyntaxNode top = call;
            while (top.Parent is MemberAccessExpressionSyntax or ConditionalAccessExpressionSyntax or MemberBindingExpressionSyntax
                       or InvocationExpressionSyntax or ParenthesizedExpressionSyntax)
                top = top.Parent;
            return top.Parent switch
            {
                BinaryExpressionSyntax b => b.OperatorToken.ValueText is "==" or "!="
                    || b.OperatorToken.ValueText is "is" or "as" && b.Left == top,
                IsPatternExpressionSyntax i => i.Expression == top,
                SwitchStatementSyntax s => s.Expression == top,
                SwitchExpressionSyntax s => s.GoverningExpression == top,
                _ => false,
            };
        }

        // An Equals method or an == / != operator may test the other object's class: that is how equality is written.
        static bool InEquality(SyntaxNode node) => node.Ancestors().Any(a =>
            a is MethodDeclarationSyntax { Identifier.ValueText: "Equals" } or OperatorDeclarationSyntax { OperatorToken.ValueText: "==" or "!=" });

        foreach (var node in Source.Root.DescendantNodes())
        {
            if (InEquality(node)) continue;
            if (node is InvocationExpressionSyntax call)
            {
                var called = call.Expression switch
                {
                    MemberAccessExpressionSyntax m => m.Name.Identifier.ValueText,
                    MemberBindingExpressionSyntax b => b.Name.Identifier.ValueText,
                    SimpleNameSyntax s => s.Identifier.ValueText,
                    _ => "",
                };
                var found = called == "GetType" && call.ArgumentList.Arguments.Count == 0 && Compared(call)
                    || called == "nameof" && call.ArgumentList.Arguments.Any(a => names.Contains(Name(a.Expression)));
                if (found)
                {
                    var whole = call.Ancestors().FirstOrDefault(a => a is BinaryExpressionSyntax or IsPatternExpressionSyntax
                        or SwitchStatementSyntax or SwitchExpressionSyntax) ?? call;
                    var text = whole is SwitchStatementSyntax s ? $"switch ({s.Expression})"
                        : whole is SwitchExpressionSyntax e ? $"{e.GoverningExpression} switch" : whole.ToString();
                    Expect.Fail("typeTest", new { code = text.Split('\n')[0].Trim() });
                }
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
