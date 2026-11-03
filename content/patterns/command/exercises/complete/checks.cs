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

    // A 3 by 2 grid: "red white blue / white red green".
    static PixelGrid Mixed()
    {
        var grid = new PixelGrid(3, 2);
        grid.Set(0, 0, "red");
        grid.Set(2, 0, "blue");
        grid.Set(1, 1, "red");
        grid.Set(2, 1, "green");
        return grid;
    }

    [Check("fill-row-paints-and-undoes")]
    static void FillRowPaintsAndUndoes()
    {
        var grid = Mixed();
        IPaintStep fill = new FillRow(grid, 0, "yellow");
        fill.Do();
        var done = grid.ToString();
        Expect.That(done == "yellow yellow yellow / white red green", "wrongFill",
            new { expected = "yellow yellow yellow / white red green", actual = done });

        fill.Undo();
        var undone = grid.ToString();
        Expect.That(undone == "red white blue / white red green", "fillNotUndone",
            new { expected = "red white blue / white red green", actual = undone });

        IPaintStep bottom = new FillRow(grid, 1, "black");
        bottom.Do();
        bottom.Undo();
        var again = grid.ToString();
        Expect.That(again == "red white blue / white red green", "fillNotUndone",
            new { expected = "red white blue / white red green", actual = again });
    }

    [Check("swap-colours-swaps-and-undoes")]
    static void SwapColoursSwapsAndUndoes()
    {
        var grid = Mixed();
        IPaintStep swap = new SwapColours(grid, "red", "white");
        swap.Do();
        var done = grid.ToString();
        Expect.That(done == "white red blue / red white green", "wrongSwap",
            new { expected = "white red blue / red white green", actual = done });

        swap.Undo();
        var undone = grid.ToString();
        Expect.That(undone == "red white blue / white red green", "swapNotUndone",
            new { expected = "red white blue / white red green", actual = undone });

        IPaintStep none = new SwapColours(grid, "pink", "blue");
        none.Do();
        var oneWay = grid.ToString();
        Expect.That(oneWay == "red white pink / white red green", "wrongSwap",
            new { expected = "red white pink / white red green", actual = oneWay });
        none.Undo();
        var back = grid.ToString();
        Expect.That(back == "red white blue / white red green", "swapNotUndone",
            new { expected = "red white blue / white red green", actual = back });
    }

    [Check("history-undoes-the-last-step-first")]
    static void HistoryUndoesTheLastStepFirst()
    {
        var grid = Mixed();
        var history = new History();
        history.Run(new PaintPixel(grid, 1, 0, "black"));
        history.Run(new FillRow(grid, 1, "blue"));
        history.Run(new SwapColours(grid, "blue", "red"));
        var all = grid.ToString();
        Expect.That(all == "blue black red / red red red", "wrongRun",
            new { expected = "blue black red / red red red", actual = all });

        string[] expected =
        [
            "red black blue / blue blue blue",
            "red black blue / white red green",
            "red white blue / white red green",
            "red white blue / white red green",
        ];
        for (var i = 0; i < expected.Length; i++)
        {
            history.Undo();
            var now = grid.ToString();
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
        history.Undo();
        var actual = string.Join(", ", calls);
        const string expected = "first.Do, second.Do, second.Undo, first.Undo";
        Expect.That(actual == expected, "wrongCalls", new { expected, actual });
    }

    [Check("history-knows-only-the-interface")]
    static void HistoryKnowsOnlyTheInterface()
    {
        foreach (var field in typeof(History).GetFields(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static
                     | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic))
            foreach (var concrete in new[] { typeof(PaintPixel), typeof(FillRow), typeof(SwapColours), typeof(PixelGrid) })
                Expect.That(!Involves(field.FieldType, concrete), "holdsConcrete", new { field = field.Name, type = concrete.Name });

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "History"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .FirstOrDefault(n => n.Identifier.ValueText is "PaintPixel" or "FillRow" or "SwapColours" or "PixelGrid");
            Expect.That(named is null, "namesConcrete", new { type = named?.Identifier.ValueText });
        }
    }

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));
}
