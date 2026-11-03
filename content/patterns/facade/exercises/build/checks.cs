using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BowlingChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly Type[] Parts = [typeof(LaneBoard), typeof(Till), typeof(ShoeCounter), typeof(Scoreboard)];

    // A new LaneDesk with an empty log. LaneDesk is either created with the four classes (in any order)
    // or has a public constructor without parameters and creates them itself; both are accepted.
    static LaneDesk NewDesk()
    {
        BowlingLog.Lines.Clear();
        foreach (var constructor in typeof(LaneDesk).GetConstructors())
        {
            var types = constructor.GetParameters().Select(p => p.ParameterType).ToArray();
            if (types.Length == Parts.Length && Parts.All(types.Contains))
                return (LaneDesk)constructor.Invoke(types.Select(t => t.GetConstructor(Type.EmptyTypes)!.Invoke(null)).ToArray());
        }
        var plain = typeof(LaneDesk).GetConstructor(Type.EmptyTypes);
        if (plain is not null) return (LaneDesk)plain.Invoke(null);
        Expect.Fail("noDeskConstructor");
        return null!;
    }

    static string Log() => BowlingLog.Lines.Count == 0 ? "nothing" : string.Join(" / ", BowlingLog.Lines);

    static string Show(int? lane) => lane?.ToString() ?? "null";

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("small-group-books-lane-four")]
    static void SmallGroupBooksLaneFour()
    {
        var lane = NewDesk().Book("Ana", ["Ana", "Bo", "Cy"]);
        var log = Log();

        Expect.That(log == "lane 4 for 3 players / charged Ana 1650 / 3 pairs of shoes / lane 4: Ana, Bo, Cy", "wrongSmall", new { expected = "lane 4 for 3 players / charged Ana 1650 / 3 pairs of shoes / lane 4: Ana, Bo, Cy", actual = log });
        Expect.That(lane == 4, "wrongSmallLane", new { actual = Show(lane) });
    }

    [Check("large-group-books-lane-nine")]
    static void LargeGroupBooksLaneNine()
    {
        var lane = NewDesk().Book("Kim's party", ["Kim", "Lou", "Max", "Ned", "Oli"]);
        var log = Log();

        Expect.That(log == "lane 9 for 5 players / charged Kim's party 2750 / 5 pairs of shoes / lane 9: Kim, Lou, Max, Ned, Oli", "wrongLarge", new { expected = "lane 9 for 5 players / charged Kim's party 2750 / 5 pairs of shoes / lane 9: Kim, Lou, Max, Ned, Oli", actual = log });
        Expect.That(lane == 9, "wrongLargeLane", new { actual = Show(lane) });
    }

    [Check("no-lane-stops-the-rest")]
    static void NoLaneStopsTheRest()
    {
        var crowd = NewDesk().Book("Pat", ["Pat", "Quin", "Rae", "Sam", "Tia", "Uma", "Vic"]);
        var crowdLog = Log();
        var nobody = NewDesk().Book("Wes", []);
        var nobodyLog = Log();

        Expect.That(crowdLog == "no lane for 7 players" && nobodyLog == "no lane for 0 players", "stepsAfterNoLane", new { crowdLog, nobodyLog });
        Expect.That(crowd is null && nobody is null, "laneWithoutLane", new { crowd = Show(crowd), nobody = Show(nobody) });
    }

    [Check("tablet-books-through-the-desk")]
    static void TabletBooksThroughTheDesk()
    {
        var reply = new BookingTablet(NewDesk()).Tap("Yan", ["Yan", "Zoe"]);
        var log = Log();
        Expect.That(reply == "Yan: lane 4" && log == "lane 4 for 2 players / charged Yan 1100 / 2 pairs of shoes / lane 4: Yan, Zoe",
            "wrongTap", new { reply, actual = log });

        var refused = new BookingTablet(NewDesk()).Tap("Club", ["A", "B", "C", "D", "E", "F", "G", "H"]);
        Expect.That(refused == "Club: no lane", "wrongRefusal", new { reply = refused });
    }

    [Check("tablet-knows-only-the-desk")]
    static void TabletKnowsOnlyTheDesk()
    {
        var tablet = typeof(BookingTablet);
        var parameter = tablet.GetConstructors().SelectMany(c => c.GetParameters()).FirstOrDefault(p => Parts.Contains(p.ParameterType));
        Expect.That(parameter is null, "tabletTakesPart", new { type = parameter?.ParameterType.Name });
        var field = tablet.GetFields(Declared).SelectMany(f => Inside(f.FieldType)).FirstOrDefault(Parts.Contains);
        Expect.That(field is null, "tabletKeepsPart", new { type = field?.Name });

        var names = Parts.Select(p => p.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "BookingTablet"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().FirstOrDefault(n => names.Contains(n.Identifier.ValueText));
            Expect.That(named is null, "tabletNamesPart", new { type = named?.Identifier.ValueText });
        }
    }
}
