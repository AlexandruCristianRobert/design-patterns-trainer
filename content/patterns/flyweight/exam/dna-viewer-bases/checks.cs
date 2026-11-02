using System.Reflection;
using DesignPatterns.Checks;

static class DnaViewerChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly (char Letter, string Name, string Colour)[] AllBases =
        [('A', "adenine", "green"), ('C', "cytosine", "blue"), ('G', "guanine", "yellow"), ('T', "thymine", "red")];

    // Every instance field of `type` and of its base classes.
    static IEnumerable<FieldInfo> Fields(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var f in t.GetFields(Declared)) yield return f;
    }

    // A field's name as the learner wrote it: "Colour" for the field behind the Colour property.
    static string Shown(FieldInfo f) => f.Name.StartsWith('<') ? f.Name[1..f.Name.IndexOf('>')] : f.Name;

    // The first field that could still be assigned after the object is made. The compiler's fields for captured
    // primary-constructor parameters are skipped; the "unchanged by use" part catches a class that assigns one.
    static FieldInfo? Writable(Type type) => Fields(type).FirstOrDefault(f => !f.IsInitOnly && !f.Name.EndsWith(">P"));

    static object?[] Snapshot(object o) => Fields(o.GetType()).Select(f => f.GetValue(o)).ToArray();

    [Check("same-letter-same-style")]
    static void SameLetterSameStyle()
    {
        var styles = new BaseStyles();
        var first = styles.Get('A');
        var second = styles.Get('A');

        Expect.That(ReferenceEquals(first, second), "notShared");
        Expect.That(styles.Created == 1, "createdTwice", new { actual = styles.Created });
    }

    [Check("lowercase-is-the-same-base")]
    static void LowercaseIsTheSameBase()
    {
        var styles = new BaseStyles();
        var lower = styles.Get('g');
        var upper = styles.Get('G');

        Expect.That(ReferenceEquals(lower, upper), "lowerNotShared");
        Expect.That(lower.Letter == 'G', "wrongLetter", new { actual = lower.Letter });
        Expect.That(styles.Created == 1, "createdForLower", new { actual = styles.Created });
    }

    [Check("each-letter-its-own-style")]
    static void EachLetterItsOwnStyle()
    {
        var styles = new BaseStyles();
        Expect.That(styles.Created == 0, "createdTooSoon", new { actual = styles.Created });
        var got = AllBases.Select(b => styles.Get(b.Letter)).ToArray();

        for (var i = 0; i < got.Length; i++)
            for (var j = i + 1; j < got.Length; j++)
                Expect.That(!ReferenceEquals(got[i], got[j]), "sameForTwo", new { first = AllBases[i].Letter, second = AllBases[j].Letter });
        for (var i = 0; i < got.Length; i++)
            Expect.That(got[i].Letter == AllBases[i].Letter && got[i].Name == AllBases[i].Name && got[i].Colour == AllBases[i].Colour, "wrongStyle",
                new { letter = AllBases[i].Letter, actual = $"{got[i].Letter}, {got[i].Name}, {got[i].Colour}", expected = $"{AllBases[i].Letter}, {AllBases[i].Name}, {AllBases[i].Colour}" });
        Expect.That(styles.Created == 4, "wrongCreated", new { actual = styles.Created });
    }

    [Check("strand-paints-its-letters")]
    static void StrandPaintsItsLetters()
    {
        var strand = new Strand(new BaseStyles(), "GATTACAgattaca");

        (int Start, int Length, string Expected)[] cases =
        [
            (0, 4, "G:yellow A:green T:red T:red"),
            (5, 4, "C:blue A:green G:yellow A:green"),
            (13, 1, "A:green"),
        ];
        foreach (var (start, length, expected) in cases)
        {
            var actual = strand.Paint(start, length);
            Expect.That(actual == expected, "wrongPaint", new { start, length, actual, expected });
        }
    }

    [Check("positions-share-their-style")]
    static void PositionsShareTheirStyle()
    {
        var styles = new BaseStyles();
        var letters = string.Concat(Enumerable.Range(0, 1000).Select(i => "acAC"[i % 4]));
        var strand = new Strand(styles, letters);
        var created = styles.Created;

        Expect.That(created == 2, "strandCreatedStyles", new { actual = created });
        for (var i = 0; i < letters.Length; i++)
            Expect.That(ReferenceEquals(strand.StyleAt(i), styles.Get(letters[i])), "notFromStyles", new { position = i, letter = letters[i] });
    }

    [Check("style-never-changes")]
    static void StyleNeverChanges()
    {
        var writable = Writable(typeof(BaseStyle));
        Expect.That(writable is null, "writableField", new { field = writable is null ? "" : Shown(writable) });

        var styles = new BaseStyles();
        var thymine = styles.Get('T');
        var before = Snapshot(thymine);
        var strand = new Strand(styles, "TTtTtt");
        strand.Paint(0, 6);
        strand.Paint(4, 2);
        Expect.That(before.SequenceEqual(Snapshot(thymine)), "changedByUse");
    }
}
