using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class CampsiteChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly Type[] Parts = [typeof(PitchPlanner), typeof(Barrier), typeof(WifiVouchers), typeof(WelcomePacks)];

    // A new Arrivals with an empty log. Arrivals is either created with the four classes (in any order)
    // or has a public constructor without parameters and creates them itself; both are accepted.
    static object NewArrivals()
    {
        CampLog.Lines.Clear();
        var type = Code.Type("Arrivals").Clr;
        foreach (var constructor in type.GetConstructors())
        {
            var types = constructor.GetParameters().Select(p => p.ParameterType).ToArray();
            if (types.Length == Parts.Length && Parts.All(types.Contains))
                return constructor.Invoke(types.Select(t => t.GetConstructor(Type.EmptyTypes)!.Invoke(null)).ToArray());
        }
        var plain = type.GetConstructor(Type.EmptyTypes);
        if (plain is not null) return plain.Invoke(null);
        Expect.Fail("noArrivalsConstructor");
        return null!;
    }

    // Calls Arrive(guest, plate, nights) on a new Arrivals and returns the pitch it gave back.
    static string? Arrive(string guest, string plate, int nights)
    {
        var arrivals = NewArrivals();
        var method = arrivals.GetType().GetMethod("Arrive", [typeof(string), typeof(string), typeof(int)]);
        if (method is null || method.ReturnType != typeof(string)) Expect.Fail("noArriveMethod");
        return (string?)method.Invoke(arrivals, [guest, plate, nights]);
    }

    // A screen of type T, made through its public constructor that takes just an Arrivals.
    static T ScreenWithArrivals<T>(string missing)
    {
        var arrivals = NewArrivals();
        var constructor = typeof(T).GetConstructor([arrivals.GetType()]);
        if (constructor is null) Expect.Fail(missing);
        return (T)constructor.Invoke([arrivals]);
    }

    static string Log() => CampLog.Lines.Count == 0 ? "nothing" : string.Join(" / ", CampLog.Lines);

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    // The first of the four classes that the screen's constructors, fields or code name, or null.
    static string? PartNamedBy(Type screen)
    {
        var parameter = screen.GetConstructors().SelectMany(c => c.GetParameters()).Select(p => p.ParameterType).FirstOrDefault(Parts.Contains);
        if (parameter is not null) return parameter.Name;
        var field = screen.GetFields(Declared).SelectMany(f => Inside(f.FieldType)).FirstOrDefault(Parts.Contains);
        if (field is not null) return field.Name;
        var names = Parts.Select(p => p.Name).ToHashSet();
        return Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(d => d.Identifier.ValueText == screen.Name)
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => names.Contains(n.Identifier.ValueText))?.Identifier.ValueText;
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "pitch Lake for Ana",
            "barrier knows AB-12",
            "wifi for Ana, 7 nights",
            "welcome pack for Ana at Lake",
            "Welcome Ana, pitch Lake",
            "pitch Meadow for Bo",
            "barrier knows CD-34",
            "wifi for Bo, 2 nights",
            "welcome pack for Bo at Meadow",
            "online: True",
            "no pitch for Cy",
            "online: False",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("arrivals-runs-the-steps-in-order")]
    static void ArrivalsRunsTheStepsInOrder()
    {
        var pitch = Arrive("Dee", "GH-78", 9);
        var log = Log();

        Expect.That(log == "pitch Lake for Dee / barrier knows GH-78 / wifi for Dee, 9 nights / welcome pack for Dee at Lake", "wrongSteps", new { actual = log });
        Expect.That(pitch == "Lake", "wrongPitch", new { actual = pitch ?? "null" });
    }

    [Check("no-pitch-stops-the-rest")]
    static void NoPitchStopsTheRest()
    {
        var tooLong = Arrive("Eve", "IJ-90", 15);
        var longLog = Log();
        var none = Arrive("Hal", "OP-3", 0);
        var noneLog = Log();

        Expect.That(longLog == "no pitch for Eve" && noneLog == "no pitch for Hal", "stepsAfterNoPitch", new { longLog, noneLog });
        Expect.That(tooLong is null && none is null, "pitchWithoutPitch", new { tooLong = tooLong ?? "null", none = none ?? "null" });
    }

    [Check("screens-check-in-through-arrivals")]
    static void ScreensCheckInThroughArrivals()
    {
        var reception = ScreenWithArrivals<ReceptionScreen>("noReceptionConstructor");
        var reply = reception.CheckIn("Fay", "KL-1", 3);
        var receptionLog = Log();
        Expect.That(reply == "Welcome Fay, pitch Meadow" && receptionLog == "pitch Meadow for Fay / barrier knows KL-1 / wifi for Fay, 3 nights / welcome pack for Fay at Meadow",
            "wrongReception", new { reply, actual = receptionLog });

        var online = ScreenWithArrivals<OnlineCheckIn>("noOnlineConstructor");
        var accepted = online.Submit("Gus", "MN-2", 0);
        var onlineLog = Log();
        Expect.That(!accepted && onlineLog == "no pitch for Gus", "wrongOnline", new { accepted, actual = onlineLog });
    }

    [Check("screens-know-only-arrivals")]
    static void ScreensKnowOnlyArrivals()
    {
        var reception = PartNamedBy(typeof(ReceptionScreen));
        Expect.That(reception is null, "receptionNamesPart", new { type = reception });
        var online = PartNamedBy(typeof(OnlineCheckIn));
        Expect.That(online is null, "onlineNamesPart", new { type = online });
    }
}
