using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class InstrumentTunerChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // No constructor of `owner` takes parameters, so nothing can be handed in from outside for it to use.
    static void NoConstructorParameters(Type owner)
    {
        var ctor = owner.GetConstructors(Instance).FirstOrDefault(c => c.GetParameters().Length > 0);
        Expect.That(ctor is null, "ownerTakesParameters", new { owner = owner.Name, parameters = ctor is null ? "" : string.Join(", ", ctor.GetParameters().Select(p => p.ParameterType.Name)) });
    }

    // Each subclass derives from `owner`, and neither it nor a class between them declares its own `operation`.
    static void OperationWrittenOnce(Type owner, string operation, params Type[] subclasses)
    {
        foreach (var sub in subclasses)
        {
            Expect.That(sub != owner && owner.IsAssignableFrom(sub), "notASubclass", new { type = sub.Name, owner = owner.Name });
            for (var t = sub; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Instance | BindingFlags.DeclaredOnly).Any(m => m.Name == operation),
                    "operationRedeclared", new { type = t.Name, method = operation });
        }
    }

    // The source of `owner` names none of the program's classes that implement `made`.
    static void NamesNoMadeClass(string owner, Type made)
    {
        var classes = made.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(InstrumentTunerChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == owner))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "ownerNamesMadeClass", new { owner, type = named });
        }
    }

    // Asks `instrument` twice for a tuner and expects two new objects of class `expected`.
    static void MakesItsOwn(Instrument instrument, Type expected)
    {
        var first = instrument.MakeTuner();
        var second = instrument.MakeTuner();
        var type = instrument.GetType().Name;
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type });
    }

    static string Describe(ITuner tuner) => $"{string.Join(" ", tuner.Notes)} / {tuner.Tool}";

    [Check("tuners-know-their-strings")]
    static void TunersKnowTheirStrings()
    {
        var guitar = Describe(new GuitarTuner());
        var violin = Describe(new ViolinTuner());
        var ukulele = Describe(new UkuleleTuner());

        Expect.That(guitar == "E A D G B E / clip-on tuner", "wrongGuitarTuner", new { actual = guitar });
        Expect.That(violin == "G D A E / tuning fork", "wrongViolinTuner", new { actual = violin });
        Expect.That(ukulele == "G C E A / phone app", "wrongUkuleleTuner", new { actual = ukulele });
    }

    [Check("each-instrument-tunes-up")]
    static void EachInstrumentTunesUp()
    {
        var guitar = new Guitar().TuneUp();
        var violin = new Violin().TuneUp();
        var ukulele = new Ukulele().TuneUp();

        Expect.That(guitar == "guitar: 6 strings, E A D G B E, with a clip-on tuner", "wrongGuitar", new { actual = guitar });
        Expect.That(violin == "violin: 4 strings, G D A E, with a tuning fork", "wrongViolin", new { actual = violin });
        Expect.That(ukulele == "ukulele: 4 strings, G C E A, with a phone app", "wrongUkulele", new { actual = ukulele });
    }

    [Check("screen-gets-a-new-tuner")]
    static void ScreenGetsANewTuner()
    {
        MakesItsOwn(new Guitar(), typeof(GuitarTuner));
        MakesItsOwn(new Violin(), typeof(ViolinTuner));
        MakesItsOwn(new Ukulele(), typeof(UkuleleTuner));
    }

    [Check("instrument-knows-only-ituner")]
    static void InstrumentKnowsOnlyITuner()
    {
        var instrument = typeof(Instrument);
        var making = instrument.GetMethod("MakeTuner", Type.EmptyTypes);
        Expect.That(making is not null && making.DeclaringType == instrument, "makeTunerElsewhere");
        Expect.That(making!.IsAbstract || making.IsVirtual && !making.IsFinal, "makeTunerFixed");

        NoConstructorParameters(instrument);
        OperationWrittenOnce(instrument, "TuneUp", typeof(Guitar), typeof(Violin), typeof(Ukulele));
        NamesNoMadeClass("Instrument", typeof(ITuner));
    }
}
