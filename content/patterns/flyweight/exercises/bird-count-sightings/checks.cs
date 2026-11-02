using System.Reflection;
using DesignPatterns.Checks;

static class BirdCountChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly (string Name, string Latin)[] AllSpecies =
        [("robin", "Erithacus rubecula"), ("blackbird", "Turdus merula"), ("wren", "Troglodytes troglodytes")];

    // Every instance field of `type` and of its base classes.
    static IEnumerable<FieldInfo> Fields(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var f in t.GetFields(Declared)) yield return f;
    }

    // A field's name as the learner wrote it: "Latin" for the field behind the Latin property.
    static string Shown(FieldInfo f) => f.Name.StartsWith('<') ? f.Name[1..f.Name.IndexOf('>')] : f.Name;

    // The first field that could still be assigned after the object is made. The compiler's fields for captured
    // primary-constructor parameters are skipped; the "unchanged by use" part catches a class that assigns one.
    static FieldInfo? Writable(Type type) => Fields(type).FirstOrDefault(f => !f.IsInitOnly && !f.Name.EndsWith(">P"));

    static object?[] Snapshot(object o) => Fields(o.GetType()).Select(f => f.GetValue(o)).ToArray();

    [Check("same-name-same-species")]
    static void SameNameSameSpecies()
    {
        var guide = new SpeciesGuide();
        var first = guide.Get("robin");
        var second = guide.Get("robin");

        Expect.That(ReferenceEquals(first, second), "notShared");
        Expect.That(guide.Created == 1, "createdTwice", new { actual = guide.Created });
    }

    [Check("each-name-its-own-species")]
    static void EachNameItsOwnSpecies()
    {
        var guide = new SpeciesGuide();
        Expect.That(guide.Created == 0, "createdTooSoon", new { actual = guide.Created });
        var got = AllSpecies.Select(s => guide.Get(s.Name)).ToArray();

        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = AllSpecies[i].Name, second = AllSpecies[j].Name });
        for (var i = 0; i < got.Length; i++)
            Expect.That(got[i].Name == AllSpecies[i].Name && got[i].Latin == AllSpecies[i].Latin, "wrongSpecies",
                new { name = AllSpecies[i].Name, actual = $"{got[i].Name} ({got[i].Latin})", expected = $"{AllSpecies[i].Name} ({AllSpecies[i].Latin})" });
        Expect.That(guide.Created == 3, "wrongCreated", new { actual = guide.Created });
    }

    [Check("survey-reports-and-totals")]
    static void SurveyReportsAndTotals()
    {
        var survey = new Survey(new SpeciesGuide());
        survey.Record("robin", "B4", 3);
        survey.Record("wren", "C1", 1);
        survey.Record("robin", "D2", 2);

        (int Index, string Expected)[] reports = [(0, "B4: robin (Erithacus rubecula), count 3"), (1, "C1: wren (Troglodytes troglodytes), count 1"), (2, "D2: robin (Erithacus rubecula), count 2")];
        foreach (var (index, expected) in reports)
        {
            var actual = survey.Report(index);
            Expect.That(actual == expected, "wrongReport", new { index, actual, expected });
        }
        (string Species, int Expected)[] totals = [("robin", 5), ("wren", 1), ("blackbird", 0)];
        foreach (var (species, expected) in totals)
        {
            var actual = survey.Total(species);
            Expect.That(actual == expected, "wrongTotal", new { species, actual, expected });
        }
    }

    [Check("sightings-share-species")]
    static void SightingsShareSpecies()
    {
        var guide = new SpeciesGuide();
        var survey = new Survey(guide);
        for (var i = 0; i < 60; i++)
            survey.Record(i % 2 == 0 ? "robin" : "blackbird", $"Q{i}", i + 1);
        var created = guide.Created;

        Expect.That(created == 2, "surveyCreatedSpecies", new { actual = created });
        for (var i = 0; i < 60; i++)
        {
            var name = i % 2 == 0 ? "robin" : "blackbird";
            Expect.That(ReferenceEquals(survey.SpeciesOf(i), guide.Get(name)), "notFromGuide", new { index = i, name });
        }
    }

    [Check("species-never-change")]
    static void SpeciesNeverChange()
    {
        var writable = Writable(typeof(Species));
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var guide = new SpeciesGuide();
        var wren = guide.Get("wren");
        var before = Snapshot(wren);
        var survey = new Survey(guide);
        survey.Record("wren", "A1", 4);
        survey.Record("wren", "Z9", 7);
        survey.Report(0);
        survey.Report(1);
        survey.Total("wren");
        Expect.That(before.SequenceEqual(Snapshot(wren)), "changedByUse");
    }
}
