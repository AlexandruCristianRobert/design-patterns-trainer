using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class RecentCallsChecks
{
    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "screen: Dentist (missed), Mum",
            "missed: 1",
            "screen: Gym (missed), Work, Sam (missed), Dentist (missed), Mum",
            "missed: 3",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    // Recent calls with these calls added in this order; none of them missed.
    static RecentCalls With(params string[] names)
    {
        var calls = new RecentCalls();
        foreach (var name in names)
            calls.Add(new Call(name, false));
        return calls;
    }

    // RecentCalls as something foreach can walk; fails when it is not an IEnumerable<Call> yet.
    static IEnumerable<Call> Walkable(RecentCalls calls)
    {
        if ((object)calls is IEnumerable<Call> walk) return walk;
        Expect.Fail("notWalkable");
        return [];
    }

    // The names a walk meets, such as "Cat, Bob", or "(none)".
    static string Names(RecentCalls calls)
    {
        var names = new List<string>();
        foreach (var call in Walkable(calls))
        {
            names.Add(call.Name);
            if (names.Count > 50) break;
        }
        return names.Count == 0 ? "(none)" : string.Join(", ", names);
    }

    [Check("a-walk-gives-the-newest-call-first")]
    static void AWalkGivesTheNewestCallFirst()
    {
        var three = Names(With("Ann", "Bob", "Cat"));
        Expect.That(three == "Cat, Bob, Ann", "wrongOrder", new { expected = "Cat, Bob, Ann", actual = three });
    }

    [Check("two-walks-keep-their-own-place")]
    static void TwoWalksKeepTheirOwnPlace()
    {
        var walk = Walkable(With("Ann", "Bob", "Cat"));
        var first = walk.GetEnumerator();
        var second = walk.GetEnumerator();
        first.MoveNext();
        var a = first.MoveNext() ? first.Current.Name : "(no call)";
        var b = second.MoveNext() ? second.Current.Name : "(no call)";
        var places = $"{a} / {b}";
        Expect.That(places == "Bob / Cat", "sharedPlace", new { expected = "Bob / Cat", actual = places });

        var guard = 0;
        while (second.MoveNext() && ++guard < 50) { }
        var next = first.MoveNext() ? first.Current.Name : "(no call)";
        Expect.That(next == "Ann", "disturbedByOther", new { expected = "Ann", actual = next });
    }

    [Check("no-calls-gives-an-empty-walk")]
    static void NoCallsGivesAnEmptyWalk()
    {
        var none = Names(new RecentCalls());
        Expect.That(none == "(none)", "wrongEmpty", new { expected = "(none)", actual = none });
    }

    [Check("the-list-stays-inside")]
    static void TheListStaysInside()
    {
        var walkable = typeof(IEnumerable<Call>).IsAssignableFrom(typeof(RecentCalls));
        Expect.That(walkable, "notWalkable");

        const BindingFlags Public = BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static;
        var field = typeof(RecentCalls).GetFields(Public).FirstOrDefault();
        Expect.That(field is null, "publicField", new { field = field?.Name });

        var shown = StorageShown(typeof(RecentCalls));
        Expect.That(shown is null, "storageShown", new { member = shown });

        foreach (var client in new[] { "CallScreen", "MissedBadge" })
        {
            var reach = ReachIn(client);
            Expect.That(reach is null, "clientReachesIn", new { client, code = reach });
        }
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

    // The first for, while or do loop, or index such as history[i], written inside the named class; null when there is none.
    static string? ReachIn(string type) =>
        Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == type)
            .SelectMany(d => d.DescendantNodes())
            .FirstOrDefault(n => n is ForStatementSyntax or WhileStatementSyntax or DoStatementSyntax or ElementAccessExpressionSyntax)
            ?.ToString().Split('\n')[0].Trim();
}
