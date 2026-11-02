using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BoatHireChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    static readonly Type[] Parts = [typeof(Jetty), typeof(Lifejackets), typeof(CashBox)];

    // A new BoatHire with an empty log. BoatHire is either created with the three classes (in any order)
    // or has a public constructor without parameters and creates them itself; both are accepted.
    static BoatHire NewHire()
    {
        HireLog.Lines.Clear();
        foreach (var constructor in typeof(BoatHire).GetConstructors())
        {
            var types = constructor.GetParameters().Select(p => p.ParameterType).ToArray();
            if (types.Length == Parts.Length && Parts.All(types.Contains))
                return (BoatHire)constructor.Invoke(types.Select(t => t.GetConstructor(Type.EmptyTypes)!.Invoke(null)).ToArray());
        }
        var plain = typeof(BoatHire).GetConstructor(Type.EmptyTypes);
        if (plain is not null) return (BoatHire)plain.Invoke(null);
        Expect.Fail("noHireConstructor");
        return null!;
    }

    static string Log() => HireLog.Lines.Count == 0 ? "nothing" : string.Join(" / ", HireLog.Lines);

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("jetty-works-on-its-own")]
    static void JettyWorksOnItsOwn()
    {
        HireLog.Lines.Clear();
        var jetty = new Jetty();
        int[] boats = [jetty.Assign(2), jetty.Assign(3), jetty.Assign(6)];
        jetty.Untie(7);
        var log = Log();

        Expect.That(boats.SequenceEqual([3, 7, 7]), "wrongBoats", new { actual = string.Join(", ", boats) });
        Expect.That(log == "boat 3 for 2 people / boat 7 for 3 people / boat 7 for 6 people / boat 7 untied", "wrongJettyLog", new { actual = log });
    }

    [Check("rent-runs-the-steps-in-order")]
    static void RentRunsTheStepsInOrder()
    {
        var boat = NewHire().Rent("Ana", 2, 2);
        var log = Log();

        Expect.That(log == "boat 3 for 2 people / took 1800 from Ana / 2 lifejackets / boat 3 untied", "wrongSteps", new { actual = log });
        Expect.That(boat == 3, "wrongBoat", new { actual = boat, expected = 3 });
    }

    [Check("bigger-group-longer-trip")]
    static void BiggerGroupLongerTrip()
    {
        var boat = NewHire().Rent("Bo", 4, 3);
        var log = Log();

        Expect.That(log == "boat 7 for 4 people / took 2700 from Bo / 4 lifejackets / boat 7 untied", "wrongBigger", new { actual = log });
        Expect.That(boat == 7, "wrongBoat", new { actual = boat, expected = 7 });
    }

    [Check("app-books-through-boat-hire")]
    static void AppBooksThroughBoatHire()
    {
        var reply = new HireApp(NewHire()).Book("Cy", 5, 1);
        var log = Log();

        Expect.That(reply == "Cy: boat 7 for 1 h", "wrongReply", new { reply });
        Expect.That(log == "boat 7 for 5 people / took 900 from Cy / 5 lifejackets / boat 7 untied", "wrongAppSteps", new { actual = log });
    }

    [Check("app-knows-only-boat-hire")]
    static void AppKnowsOnlyBoatHire()
    {
        var app = typeof(HireApp);
        var parameter = app.GetConstructors().SelectMany(c => c.GetParameters()).FirstOrDefault(p => Parts.Contains(p.ParameterType));
        Expect.That(parameter is null, "appTakesPart", new { type = parameter?.ParameterType.Name });
        var field = app.GetFields(Declared).SelectMany(f => Inside(f.FieldType)).FirstOrDefault(Parts.Contains);
        Expect.That(field is null, "appKeepsPart", new { type = field?.Name });

        var names = Parts.Select(p => p.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "HireApp"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().FirstOrDefault(n => names.Contains(n.Identifier.ValueText));
            Expect.That(named is null, "appNamesPart", new { type = named?.Identifier.ValueText });
        }
    }
}
