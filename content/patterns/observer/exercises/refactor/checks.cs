using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class StockChecks
{
    sealed class Recorder : IStockObserver
    {
        public List<(string Symbol, decimal Price)> Received { get; } = [];
        public void PriceChanged(string symbol, decimal price) => Received.Add((symbol, price));
    }

    static readonly string[] ConcreteListeners = ["Logger", "Chart", "Alerts"];

    // The type itself plus every element and generic argument type, e.g. List<Logger> yields List<Logger> and Logger.
    static IEnumerable<Type> Mentioned(Type t)
    {
        yield return t;
        if (t.GetElementType() is { } element)
            foreach (var x in Mentioned(element)) yield return x;
        if (t.IsGenericType)
            foreach (var arg in t.GetGenericArguments())
                foreach (var x in Mentioned(arg)) yield return x;
    }

    [Check("observers-receive-price")]
    static void ObserversReceivePrice()
    {
        var stock = new Stock("XYZ");
        var first = new Recorder();
        var second = new Recorder();
        stock.Attach(first);
        stock.Attach(second);

        stock.SetPrice(12.5m);

        foreach (var r in new[] { first, second })
        {
            Expect.That(r.Received.Count == 1, "wrongCallCount", new { calls = r.Received.Count });
            var (symbol, price) = r.Received[0];
            Expect.That(symbol == "XYZ" && price == 12.5m, "wrongUpdate", new { symbol, price });
        }
    }

    [Check("stock-has-no-concrete-dependencies")]
    static void StockHasNoConcreteDependencies()
    {
        var fields = Code.Type("Stock").Clr.GetFields(BindingFlags.Instance | BindingFlags.Static |
            BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
        foreach (var field in fields)
        {
            var concrete = Mentioned(field.FieldType).FirstOrDefault(t => ConcreteListeners.Contains(t.Name));
            Expect.That(concrete is null, "concreteField", new { type = concrete?.Name });
        }

        var stockDeclarations = Source.Root.DescendantNodes().OfType<ClassDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "Stock");
        foreach (var declaration in stockDeclarations)
        {
            var named = declaration.DescendantNodes().OfType<IdentifierNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(ConcreteListeners.Contains);
            Expect.That(named is null, "stockNamesListener", new { type = named });
        }

        // A Stock nobody attached anything to must stay silent.
        Screen.Lines.Clear();
        new Stock("XYZ").SetPrice(1000m);
        Expect.That(Screen.Lines.Count == 0, "stockCreatesListeners");
    }

    [Check("detach-works")]
    static void DetachWorks()
    {
        var stock = new Stock("XYZ");
        var leaving = new Recorder();
        var staying = new Recorder();
        stock.Attach(leaving);
        stock.Attach(staying);

        stock.Detach(leaving);
        stock.SetPrice(7m);

        Expect.That(leaving.Received.Count == 0, "notifiedAfterDetach");
        Expect.That(staying.Received.Count > 0, "stayingMissed");
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "log: ACME is now 100",
            "chart: 100 (start)",
            "log: ACME is now 104",
            "chart: 104 (up)",
            "alert: ACME above 103",
            "log: ACME is now 98",
            "chart: 98 (down)",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }
}
