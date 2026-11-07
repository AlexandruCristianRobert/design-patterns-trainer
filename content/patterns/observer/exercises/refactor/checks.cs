using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class StockChecks
{
    sealed class Recorder : IStockObserver
    {
        public List<(string Symbol, int Price)> Received { get; } = [];
        public void PriceChanged(string symbol, int price) => Received.Add((symbol, price));
    }

    static readonly string[] ConcreteListeners = ["Logger", "Chart", "Alerts"];

    static string Show(Recorder r) =>
        r.Received.Count == 0 ? "nothing" : string.Join(", ", r.Received.Select(x => $"{x.Symbol} {x.Price}"));

    [Check("observers-receive-price")]
    static void ObserversReceivePrice()
    {
        var stock = new Stock("XYZ");
        var first = new Recorder();
        var second = new Recorder();
        stock.Attach(first);
        stock.Attach(second);

        stock.SetPrice(12);

        foreach (var r in new[] { first, second })
            Expect.That(Show(r) == "XYZ 12", "wrongUpdate", new { expected = "XYZ 12", actual = Show(r) });
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
        stock.SetPrice(7);

        Expect.That(leaving.Received.Count == 0, "notifiedAfterDetach");
        Expect.That(staying.Received.Count > 0, "stayingMissed");
    }

    [Check("stock-has-no-concrete-dependencies")]
    static void StockHasNoConcreteDependencies()
    {
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "Stock"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(ConcreteListeners.Contains);
            Expect.That(named is null, "stockNamesListener", new { type = named });
        }
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "log: ACME is now 100",
            "chart: 100",
            "log: ACME is now 104",
            "chart: 104",
            "alert: ACME above 103",
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
