using System.Reflection;
using DesignPatterns.Checks;

static class NightBusChecks
{
    static BusRoute Route(params string[] stops)
    {
        var route = new BusRoute();
        foreach (var stop in stops)
            route.AddStop(stop);
        return route;
    }

    static BusRoute Night() => Route("Station", "Market", "Castle Street", "Hospital", "Airport");

    // The stops a run meets, such as "Station, Market", or "(none)".
    static string Stops(IEnumerable<string> run)
    {
        var met = new List<string>();
        foreach (var stop in run)
        {
            met.Add(stop);
            if (met.Count > 50) break;
        }
        return met.Count == 0 ? "(none)" : string.Join(", ", met);
    }

    static string Step(IEnumerator<string> run) => run.MoveNext() ? run.Current : "(none)";

    [Check("outbound-goes-first-to-last")]
    static void OutboundGoesFirstToLast()
    {
        var all = Stops(Night().Outbound());
        const string expected = "Station, Market, Castle Street, Hospital, Airport";
        Expect.That(all == expected, "wrongOutbound", new { expected, actual = all });

        var one = Stops(Route("Depot").Outbound());
        Expect.That(one == "Depot", "wrongOutbound", new { expected = "Depot", actual = one });
    }

    [Check("inbound-goes-last-to-first")]
    static void InboundGoesLastToFirst()
    {
        var all = Stops(Night().Inbound());
        const string expected = "Airport, Hospital, Castle Street, Market, Station";
        Expect.That(all == expected, "wrongInbound", new { expected, actual = all });

        var one = Stops(Route("Depot").Inbound());
        Expect.That(one == "Depot", "wrongInbound", new { expected = "Depot", actual = one });
    }

    [Check("closed-stops-are-left-out")]
    static void ClosedStopsAreLeftOut()
    {
        var route = Night();
        route.Close("Castle Street");
        route.Close("Station");
        var outbound = Stops(route.Outbound());
        var inbound = Stops(route.Inbound());
        Expect.That(outbound == "Market, Hospital, Airport", "closedMet",
            new { run = "Outbound", expected = "Market, Hospital, Airport", actual = outbound });
        Expect.That(inbound == "Airport, Hospital, Market", "closedMet",
            new { run = "Inbound", expected = "Airport, Hospital, Market", actual = inbound });

        route.Reopen("Station");
        var reopened = Stops(route.Outbound());
        Expect.That(reopened == "Station, Market, Hospital, Airport", "reopenedMissing",
            new { expected = "Station, Market, Hospital, Airport", actual = reopened });

        var shut = Route("Lane End", "Mill");
        shut.Close("Lane End");
        shut.Close("Mill");
        var none = $"{Stops(shut.Outbound())} / {Stops(shut.Inbound())}";
        Expect.That(none == "(none) / (none)", "closedMet", new { run = "Both runs, with every stop closed,", expected = "(none) / (none)", actual = none });
    }

    [Check("runs-at-the-same-time-keep-their-own-place")]
    static void RunsAtTheSameTimeKeepTheirOwnPlace()
    {
        var route = Night();
        foreach (var (run, order) in new[]
        {
            ("Outbound", new[] { "Station", "Market", "Castle Street", "Hospital", "Airport" }),
            ("Inbound", new[] { "Airport", "Hospital", "Castle Street", "Market", "Station" }),
        })
        {
            var handedOut = run == "Outbound" ? route.Outbound() : route.Inbound();
            var first = handedOut.GetEnumerator();
            var second = handedOut.GetEnumerator();
            Step(first);
            var a = Step(first);
            var b = Step(second);
            var places = $"{a} / {b}";
            var expectedPlaces = $"{order[1]} / {order[0]}";
            Expect.That(places == expectedPlaces, "sharedPlace", new { run, expected = expectedPlaces, actual = places });

            while (second.MoveNext()) { }
            var next = Step(first);
            Expect.That(next == order[2], "disturbedByOther", new { run, expected = order[2], actual = next });

            var again = $"{Stops(handedOut)} | {Stops(handedOut)}";
            var all = string.Join(", ", order);
            var twice = $"{all} | {all}";
            Expect.That(again == twice, "usedUp", new { run, expected = twice, actual = again });
        }

        var there = route.Outbound().GetEnumerator();
        var back = route.Inbound().GetEnumerator();
        Step(there);
        var c = Step(there);
        var d = Step(back);
        var both = $"{c} / {d}";
        Expect.That(both == "Market / Airport", "runsMixed", new { expected = "Market / Airport", actual = both });
    }

    [Check("an-empty-route-gives-empty-runs")]
    static void AnEmptyRouteGivesEmptyRuns()
    {
        var route = new BusRoute();
        var both = $"{Stops(route.Outbound())} / {Stops(route.Inbound())}";
        Expect.That(both == "(none) / (none)", "wrongEmpty", new { expected = "(none) / (none)", actual = both });
    }

    [Check("the-route-keeps-its-stops-to-itself")]
    static void TheRouteKeepsItsStopsToItself()
    {
        var shown = StorageShown(typeof(BusRoute));
        Expect.That(shown is null, "storageShown", new { member = shown });

        foreach (var run in new[] { "Outbound", "Inbound" })
        {
            var route = Night();
            var handedOut = run == "Outbound" ? route.Outbound() : route.Inbound();
            TryToChange(handedOut);
            var after = Stops(route.Outbound());
            const string expected = "Station, Market, Castle Street, Hospital, Airport";
            Expect.That(after == expected, "storageChanged", new { run, expected, actual = after });
        }
    }

    // Writes over and clears what a run handed out, when it lets itself be changed like a list or an array.
    static void TryToChange(IEnumerable<string> handedOut)
    {
        if (handedOut is IList<string> list && list.Count > 0)
            try { list[0] = "Changed"; } catch (NotSupportedException) { }
        if (handedOut is ICollection<string> collection && !collection.IsReadOnly)
            try { collection.Clear(); } catch (NotSupportedException) { }
    }

    // The first public member of the type that hands out an array or a collection: a field, a property or a method; null when there is none.
    static string? StorageShown(Type type)
    {
        const BindingFlags Public = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static;
        var field = type.GetFields(Public).FirstOrDefault(f => IsStorage(f.FieldType));
        if (field is not null) return field.Name;
        var property = type.GetProperties(Public).FirstOrDefault(p => IsStorage(p.PropertyType));
        if (property is not null) return property.Name;
        return type.GetMethods(Public).FirstOrDefault(m => !m.IsSpecialName && IsStorage(m.ReturnType))?.Name;
    }

    // An array, or a type that can be counted and changed like a list: anything beyond a walk.
    static bool IsStorage(Type type) =>
        type.IsArray
        || typeof(System.Collections.ICollection).IsAssignableFrom(type)
        || type.GetInterfaces().Append(type).Any(i => i.IsGenericType
            && (i.GetGenericTypeDefinition() == typeof(ICollection<>) || i.GetGenericTypeDefinition() == typeof(IReadOnlyCollection<>)));
}
