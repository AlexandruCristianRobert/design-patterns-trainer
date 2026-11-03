using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class TaxReturnIncomesChecks
{
    const string ReportName = "IIncomeVisitor";
    const string HandOver = "Accept";
    static readonly string[] Classes = ["Salary", "Rent", "Dividend"];
    static readonly string[] Reports = ["TaxDue", "IncomeLines"];

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "salary: 30000 EUR",
            "rent: 9000 EUR, less 2000 EUR costs",
            "dividend: 1500 EUR, 500 EUR tax-free",
            "salary: 4000 EUR",
            "tax to pay: 8300 EUR",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("tax-follows-each-income-rule")]
    static void TaxFollowsEachIncomeRule()
    {
        (string Incomes, List<IIncome> Made, int Tax)[] cases =
        [
            ("a salary of 30000", [new Salary(30000)], 6000),
            ("rent of 9000 with 2000 costs", [new Rent(9000, 2000)], 1400),
            ("a dividend of 1500", [new Dividend(1500)], 100),
            ("a dividend of 400", [new Dividend(400)], 0),
            ("no income", [], 0),
            ("a salary of 1000, rent of 5000 with 5000 costs and two dividends of 2500", [new Salary(1000), new Rent(5000, 5000), new Dividend(2500), new Dividend(2500)], 600),
        ];
        foreach (var (incomes, made, tax) in cases)
        {
            var actual = new TaxReturn(made).TotalTax();
            Expect.That(actual == tax, "wrongTax", new { incomes, expected = tax, actual });
        }
    }

    [Check("lines-describe-each-income")]
    static void LinesDescribeEachIncome()
    {
        var taxReturn = new TaxReturn([new Dividend(800), new Rent(1200, 300), new Salary(2500), new Dividend(100)]);
        const string expected = "dividend: 800 EUR, 500 EUR tax-free | rent: 1200 EUR, less 300 EUR costs | salary: 2500 EUR | dividend: 100 EUR, 500 EUR tax-free";
        var actual = string.Join(" | ", taxReturn.Lines());
        Expect.That(actual == expected, "wrongLines", new { expected, actual });
        var none = new TaxReturn([]).Lines().Count;
        Expect.That(none == 0, "linesWithoutIncome", new { expected = 0, actual = none });
    }

    [Check("one-visit-per-income-class")]
    static void OneVisitPerIncomeClass() => ExpectOneMethodPerClass();

    [Check("each-income-has-its-own-accept")]
    static void EachIncomeHasItsOwnAccept() => ExpectOwnHandOver();

    [Check("incomes-keep-no-tax-rules")]
    static void IncomesKeepNoTaxRules() => ExpectNoOtherMethods();

    [Check("nothing-tests-the-kind-of-income")]
    static void NothingTestsTheKindOfIncome() => ExpectNoTypeTests();

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
