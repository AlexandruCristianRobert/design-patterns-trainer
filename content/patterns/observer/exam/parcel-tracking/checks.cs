using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ParcelTrackingChecks
{
    sealed class Recorder : IParcelAlertSink
    {
        public List<(string Code, string Status)> Heard { get; } = [];
        public void StatusChanged(string trackingCode, string status) => Heard.Add((trackingCode, status));
    }

    // The type itself plus every element and generic argument type, e.g. List<SmsAlert> yields List<SmsAlert> and SmsAlert.
    static IEnumerable<Type> Mentioned(Type t)
    {
        yield return t;
        if (t.GetElementType() is { } element)
            foreach (var x in Mentioned(element)) yield return x;
        if (t.IsGenericType)
            foreach (var arg in t.GetGenericArguments())
                foreach (var x in Mentioned(arg)) yield return x;
    }

    static string Show(List<(string Code, string Status)> heard) =>
        heard.Count == 0 ? "nothing" : string.Join(", ", heard.Select(h => $"{h.Code} {h.Status}"));

    [Check("every-sink-told-each-change")]
    static void EverySinkToldEachChange()
    {
        var parcel = new Parcel("PX-1");
        var first = new Recorder();
        var second = new Recorder();
        parcel.Track(first);
        parcel.Track(second);

        parcel.UpdateStatus("Shipped");
        parcel.UpdateStatus("Delivered");

        foreach (var r in new[] { first, second })
            Expect.That(r.Heard.SequenceEqual([("PX-1", "Shipped"), ("PX-1", "Delivered")]), "wrongUpdates",
                new { actual = Show(r.Heard) });
        Expect.That(parcel.Status == "Delivered", "statusNotStored", new { status = parcel.Status });
    }

    [Check("same-status-not-repeated")]
    static void SameStatusNotRepeated()
    {
        var parcel = new Parcel("PX-2");
        var r = new Recorder();
        parcel.Track(r);

        parcel.UpdateStatus("Registered");
        parcel.UpdateStatus("Shipped");
        parcel.UpdateStatus("Shipped");
        parcel.UpdateStatus("Delivered");

        Expect.That(r.Heard.SequenceEqual([("PX-2", "Shipped"), ("PX-2", "Delivered")]), "repeatedOrMissed",
            new { actual = Show(r.Heard) });
    }

    [Check("untracked-sink-not-told")]
    static void UntrackedSinkNotTold()
    {
        var parcel = new Parcel("PX-3");
        var leaving = new Recorder();
        var staying = new Recorder();
        parcel.Track(leaving);
        parcel.Track(staying);

        parcel.Untrack(leaving);
        parcel.UpdateStatus("Shipped");

        Expect.That(leaving.Heard.Count == 0, "toldAfterUntrack");
        Expect.That(staying.Heard.Count == 1, "stayingMissed");
    }

    [Check("no-sinks-ok")]
    static void NoSinksOk()
    {
        var parcel = new Parcel("PX-4");
        parcel.UpdateStatus("Shipped");

        var stranger = new Recorder();
        parcel.Untrack(stranger);
        parcel.UpdateStatus("Delivered");

        Expect.That(stranger.Heard.Count == 0, "strangerTold");
        Expect.That(parcel.Status == "Delivered", "statusNotStored", new { status = parcel.Status });
    }

    [Check("parcel-knows-only-the-interface")]
    static void ParcelKnowsOnlyTheInterface()
    {
        var concrete = typeof(IParcelAlertSink).Assembly.GetTypes()
            .Where(t => !t.IsInterface && typeof(IParcelAlertSink).IsAssignableFrom(t) && t.DeclaringType != typeof(ParcelTrackingChecks))
            .Select(t => t.Name).ToHashSet();

        var fields = Code.Type("Parcel").Clr.GetFields(BindingFlags.Instance | BindingFlags.Static |
            BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
        foreach (var field in fields)
        {
            var named = Mentioned(field.FieldType).FirstOrDefault(t => concrete.Contains(t.Name));
            Expect.That(named is null, "concreteField", new { type = named?.Name });
        }

        foreach (var declaration in Source.Root.DescendantNodes().OfType<ClassDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "Parcel"))
        {
            var named = declaration.DescendantNodes().OfType<IdentifierNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "parcelNamesSink", new { type = named });
        }
    }
}
