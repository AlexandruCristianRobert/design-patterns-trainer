using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PixelArtChecks
{
    // A step for the Checks only: it paints nothing and writes down each call it gets.
    sealed class Probe(string name, List<string> calls) : IPaintStep
    {
        public void Do() => calls.Add($"{name}.Do");
        public void Undo() => calls.Add($"{name}.Undo");
    }

    // A canvas of "red white blue".
    static Canvas RedWhiteBlue()
    {
        var canvas = new Canvas(3);
        canvas.Set(0, "red");
        canvas.Set(2, "blue");
        return canvas;
    }

    [Check("swap-pixels-swaps-and-undoes")]
    static void SwapPixelsSwapsAndUndoes()
    {
        var canvas = RedWhiteBlue();
        IPaintStep swap = new SwapPixels(canvas, 0, 2);
        swap.Do();
        var done = canvas.ToString();
        Expect.That(done == "blue white red", "wrongSwap", new { expected = "blue white red", actual = done });

        swap.Undo();
        var undone = canvas.ToString();
        Expect.That(undone == "red white blue", "swapNotUndone", new { expected = "red white blue", actual = undone });
    }

    [Check("history-undoes-the-last-step-first")]
    static void HistoryUndoesTheLastStepFirst()
    {
        var canvas = RedWhiteBlue();
        var history = new History();
        history.Run(new PaintPixel(canvas, 1, "green"));
        history.Run(new SwapPixels(canvas, 0, 1));
        history.Run(new PaintPixel(canvas, 2, "black"));
        var all = canvas.ToString();
        Expect.That(all == "green red black", "wrongRun", new { expected = "green red black", actual = all });

        string[] expected = ["green red blue", "red green blue", "red white blue"];
        for (var i = 0; i < expected.Length; i++)
        {
            history.Undo();
            var now = canvas.ToString();
            Expect.That(now == expected[i], "wrongUndo", new { undos = i + 1, expected = expected[i], actual = now });
        }
    }

    [Check("history-runs-any-step")]
    static void HistoryRunsAnyStep()
    {
        var calls = new List<string>();
        var history = new History();
        history.Run(new Probe("first", calls));
        history.Run(new Probe("second", calls));
        history.Undo();
        history.Undo();
        var actual = string.Join(", ", calls);
        const string expected = "first.Do, second.Do, second.Undo, first.Undo";
        Expect.That(actual == expected, "wrongCalls", new { expected, actual });
    }

    [Check("history-knows-only-the-interface")]
    static void HistoryKnowsOnlyTheInterface()
    {
        string[] concrete = ["PaintPixel", "SwapPixels", "Canvas"];
        foreach (var field in typeof(History).GetFields(BindingFlags.Instance | BindingFlags.Static
                     | BindingFlags.Public | BindingFlags.NonPublic))
            foreach (var type in new[] { typeof(PaintPixel), typeof(SwapPixels), typeof(Canvas) })
                Expect.That(!Involves(field.FieldType, type), "holdsConcrete", new { field = field.Name, type = type.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "History")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => concrete.Contains(n.Identifier.ValueText));
        Expect.That(named is null, "namesConcrete", new { type = named?.Identifier.ValueText });
    }

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));
}
