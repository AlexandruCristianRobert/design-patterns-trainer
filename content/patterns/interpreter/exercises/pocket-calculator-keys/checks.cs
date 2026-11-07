using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PocketCalculatorChecks
{
    // Three memories, each with the words the failure messages use for it.
    static readonly (Memory Memory, string Said)[] Memories =
    [
        (new Memory(5), "5 in memory"),
        (new Memory(10), "10 in memory"),
        (new Memory(0), "0 in memory"),
    ];

    // Works the formula out for each of the three memories.
    static void Try(Formula formula, string written, int[] expected)
    {
        for (var i = 0; i < Memories.Length; i++)
        {
            var actual = formula.Value(Memories[i].Memory);
            Expect.That(actual == expected[i], "wrongValue", new { formula = written, memory = Memories[i].Said, expected = expected[i], actual });
        }
    }

    [Check("number-and-recall-give-their-values")]
    static void NumberAndRecallGiveTheirValues()
    {
        Try(new Number(7), "Number(7)", [7, 7, 7]);
        Try(new Number(-2), "Number(-2)", [-2, -2, -2]);
        Try(new Recall(), "Recall()", [5, 10, 0]);
    }

    [Check("add-and-subtract-work-on-their-two-parts")]
    static void AddAndSubtractWorkOnTheirTwoParts()
    {
        Try(new Add(new Recall(), new Number(2)), "Add(Recall(), Number(2))", [7, 12, 2]);
        Try(new Subtract(new Recall(), new Number(4)), "Subtract(Recall(), Number(4))", [1, 6, -4]);
        Try(new Subtract(new Number(4), new Recall()), "Subtract(Number(4), Recall())", [-1, -6, 4]);
    }

    [Check("nested-formulas-work-out-every-memory")]
    static void NestedFormulasWorkOutEveryMemory()
    {
        Try(new Subtract(new Add(new Recall(), new Recall()), new Number(1)),
            "Subtract(Add(Recall(), Recall()), Number(1))", [9, 19, -1]);
        Try(new Subtract(new Number(100), new Add(new Recall(), new Subtract(new Recall(), new Number(3)))),
            "Subtract(Number(100), Add(Recall(), Subtract(Recall(), Number(3))))", [93, 83, 103]);
        Try(new Add(new Add(new Recall(), new Number(1)), new Subtract(new Recall(), new Subtract(new Number(2), new Recall()))),
            "Add(Add(Recall(), Number(1)), Subtract(Recall(), Subtract(Number(2), Recall())))", [14, 29, -1]);
    }

    [Check("one-class-per-key")]
    static void OneClassPerKey()
    {
        foreach (var type in new[] { typeof(Number), typeof(Recall), typeof(Add), typeof(Subtract) })
        {
            Expect.That(typeof(Formula).IsAssignableFrom(type), "notAFormula", new { type = type.Name });
            Expect.That(HasOwn(type, "Value"), "notItsOwn", new { type = type.Name });
        }

        var test = KindTest();
        Expect.That(test is null, "kindTest", new { code = test });
    }

    // The type writes the method itself (an override, an interface method or an explicit one), not only inherits it.
    static bool HasOwn(Type type, string method) =>
        type.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly)
            .Any(m => !m.IsAbstract && (m.Name == method || m.Name.EndsWith("." + method)));

    // The first code that tests what kind of object it has: a switch, is, as, typeof or GetType(); null when there is none.
    static string? KindTest(params string[] skip) =>
        Source.Root.DescendantNodes()
            .Where(n => !n.Ancestors().OfType<TypeDeclarationSyntax>().Any(d => skip.Contains(d.Identifier.ValueText)))
            .FirstOrDefault(n => n is SwitchStatementSyntax or SwitchExpressionSyntax or IsPatternExpressionSyntax or TypeOfExpressionSyntax
                || n is BinaryExpressionSyntax { OperatorToken.ValueText: "is" or "as" }
                || n is InvocationExpressionSyntax call && call.Expression.ToString().EndsWith("GetType"))
            ?.ToString().Split('\n')[0].Trim();
}