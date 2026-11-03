using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class MusicBoxChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // True when `type` or one of its base classes keeps an instance field of type `held`.
    static bool Keeps(Type type, Type held)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            if (t.GetFields(Declared).Any(f => f.FieldType == held)) return true;
        return false;
    }

    // No class that is `top` or derives from it names one of the program's classes that implement or derive from `held`.
    static void NamesNoInstrumentClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesInstrument", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    [Check("instruments-sound-their-notes")]
    static void InstrumentsSoundTheirNotes()
    {
        var box = $"{new MusicBox().Note("G")} / {new MusicBox().Rest()}";
        var xylophone = $"{new Xylophone().Note("G")} / {new Xylophone().Rest()}";

        Expect.That(box == "plink G / ...", "wrongMusicBox", new { expected = "plink G / ...", actual = box });
        Expect.That(xylophone == "tok G / -", "wrongXylophone", new { expected = "tok G / -", actual = xylophone });
    }

    [Check("lullaby-on-both-instruments")]
    static void LullabyOnBothInstruments()
    {
        var box = new Lullaby(new MusicBox()).Play();
        var xylophone = new Lullaby(new Xylophone()).Play();

        Expect.That(box == "plink C plink E plink G ... plink G plink E plink C", "wrongLullaby",
            new { instrument = "music box", actual = box, expected = "plink C plink E plink G ... plink G plink E plink C" });
        Expect.That(xylophone == "tok C tok E tok G - tok G tok E tok C", "wrongLullaby",
            new { instrument = "xylophone", actual = xylophone, expected = "tok C tok E tok G - tok G tok E tok C" });
    }

    [Check("scale-plays-the-first-notes")]
    static void ScalePlaysTheFirstNotes()
    {
        (string Instrument, int Count, string Actual, string Expected)[] scales =
        [
            ("music box", 3, new Scale(new MusicBox(), 3).Play(), "plink C plink D plink E ..."),
            ("xylophone", 7, new Scale(new Xylophone(), 7).Play(), "tok C tok D tok E tok F tok G tok A tok B -"),
            ("xylophone", 0, new Scale(new Xylophone(), 0).Play(), "-"),
        ];
        foreach (var (instrument, count, actual, expected) in scales)
            Expect.That(actual == expected, "wrongScale", new { instrument, count, actual, expected });
    }

    [Check("tunes-hold-an-instrument")]
    static void TunesHoldAnInstrument()
    {
        var instrument = typeof(Instrument);
        Expect.That(instrument.IsInterface || instrument.IsAbstract, "instrumentNotAbstract");
        foreach (var tune in new[] { typeof(Lullaby), typeof(Scale) })
        {
            Expect.That(typeof(Tune).IsAssignableFrom(tune), "notATune", new { type = tune.Name });
            Expect.That(Keeps(tune, instrument), "holdsNoInstrument", new { type = tune.Name });
        }
        NamesNoInstrumentClass(typeof(Tune), instrument);
    }
}
