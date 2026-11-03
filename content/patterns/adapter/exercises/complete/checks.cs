using System.Globalization;
using System.Reflection;
using DesignPatterns.Checks;

static class TideChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // The tides the board would get for these readings.
    static IReadOnlyList<Tide> TidesFor(params string[] readings) =>
        ((ITideTable)new SeaOfficeTides(new SeaOfficeFeed(readings))).Tides();

    static string Show(IEnumerable<Tide> tides) =>
        string.Join(", ", tides.Select(t => string.Create(CultureInfo.InvariantCulture,
            $"{t.Time:HH:mm} {(t.High ? "high" : "low")} {t.Metres:0.###} m")));

    [Check("readings-become-tides")]
    static void ReadingsBecomeTides()
    {
        var tides = TidesFor("HW 0612 13.8", "LW 1240 2.0");

        Expect.That(tides.Count == 2, "wrongCount", new { count = tides.Count, actual = Show(tides) });
        var (high, low) = (tides[0], tides[1]);
        Expect.That(high.High && !low.High, "wrongHighLow", new { actual = Show(tides) });
        Expect.That(high.Time == new TimeOnly(6, 12) && low.Time == new TimeOnly(12, 40), "wrongTime", new { actual = Show(tides) });
        Expect.That(Math.Abs(high.Metres - 4.206) < 0.001 && Math.Abs(low.Metres - 0.610) < 0.001, "wrongMetres", new { actual = Show(tides) });
    }

    [Check("every-reading-comes-from-the-feed")]
    static void EveryReadingComesFromTheFeed()
    {
        var tides = TidesFor("LW 0005 1.0", "HW 0630 10.0", "LW 1255 0.5", "HW 2359 12.5");
        var shown = Show(tides);
        var none = TidesFor();

        Expect.That(shown == "00:05 low 0.305 m, 06:30 high 3.048 m, 12:55 low 0.152 m, 23:59 high 3.81 m", "wrongDay", new { expected = "00:05 low 0.305 m, 06:30 high 3.048 m, 12:55 low 0.152 m, 23:59 high 3.81 m", actual = shown });
        Expect.That(none.Count == 0, "emptyFeedGaveTides", new { actual = Show(none) });
    }

    [Check("board-shows-metres")]
    static void BoardShowsMetres()
    {
        var lines = new HarbourBoard(new SeaOfficeTides(new SeaOfficeFeed("HW 0612 13.8", "LW 1240 2.0"))).Lines();
        var shown = string.Join(" / ", lines);

        Expect.That(shown == "06:12 high 4.2 m / 12:40 low 0.6 m", "wrongBoard", new { expected = "06:12 high 4.2 m / 12:40 low 0.6 m", actual = shown });
    }

    [Check("tides-come-through-the-table")]
    static void TidesComeThroughTheTable()
    {
        var type = typeof(SeaOfficeTides);
        Expect.That(typeof(ITideTable).IsAssignableFrom(type), "notATable");
        Expect.That(!typeof(ITideTable).IsAssignableFrom(typeof(SeaOfficeFeed)), "feedChanged");

        var fields = new List<FieldInfo>();
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            fields.AddRange(t.GetFields(Declared));
        Expect.That(fields.Any(f => f.FieldType == typeof(SeaOfficeFeed)), "noFeedKept");
    }
}
