using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class AudioGuideChecks
{
    // A guide the program has never seen. It says which one it is, so the lines show which guide spoke.
    sealed class TestGuide(int id) : IGuide
    {
        public string Describe(string exhibit) => $"test guide {id} at {exhibit}";
    }

    // A kind of tour the program has never seen. It counts how often Tour asked it for a guide.
    sealed class TestTour : Tour
    {
        public int Made { get; private set; }

        protected override IGuide CreateGuide() => new TestGuide(++Made);
    }

    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // The method `owner` declares that returns a `made`: abstract or virtual, public or protected, taking `parameters`.
    static MethodInfo MakingMethod(Type owner, Type made, params Type[] parameters)
    {
        var found = owner.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { owner = owner.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Select(p => p.ParameterType).SequenceEqual(parameters));
        if (method is null) Expect.Fail("makingMethodParameters", new { owner = owner.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { owner = owner.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsFamily || method.IsFamilyOrAssembly, "makingMethodPrivate", new { owner = owner.Name, method = method.Name });
        return method;
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
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(AudioGuideChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == owner))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "ownerNamesMadeClass", new { owner, type = named });
        }
    }

    // Asks a new `type` twice through `making` and expects two new objects of class `expected`.
    static void MakesItsOwn(MethodInfo making, Type type, Type expected)
    {
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        var instance = ctor.Invoke(null);
        var first = making.Invoke(instance, null);
        var second = making.Invoke(instance, null);
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type = type.Name, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = making.Name });
    }

    [Check("play-numbers-each-exhibit")]
    static void PlayNumbersEachExhibit()
    {
        var tour = new TestTour();
        var lines = string.Join(" | ", tour.Play(["vase", "coin", "drum"]));

        Expect.That(lines == "1. test guide 1 at vase | 2. test guide 1 at coin | 3. test guide 1 at drum", "wrongLines", new { actual = lines });
        Expect.That(tour.Made == 1, "guidesPerPlay", new { made = tour.Made });
    }

    [Check("new-guide-every-tour")]
    static void NewGuideEveryTour()
    {
        var tour = new TestTour();
        tour.Play(["vase"]);
        var second = string.Join(" | ", tour.Play(["coin"]));

        Expect.That(tour.Made == 2, "guidesForTwoPlays", new { made = tour.Made });
        Expect.That(second == "1. test guide 2 at coin", "secondTourOldGuide", new { actual = second });
    }

    [Check("family-tour-tells-stories")]
    static void FamilyTourTellsStories()
    {
        var lines = string.Join(" | ", new FamilyTour().Play(["golden mask", "sun clock"]));

        Expect.That(lines == "1. Here is the story of the golden mask. | 2. Here is the story of the sun clock.", "wrongFamily", new { actual = lines });
    }

    [Check("expert-tour-gives-facts")]
    static void ExpertTourGivesFacts()
    {
        var lines = string.Join(" | ", new ExpertTour().Play(["golden mask", "sun clock"]));

        Expect.That(lines == "1. The golden mask: date, maker and materials. | 2. The sun clock: date, maker and materials.", "wrongExpert", new { actual = lines });
    }

    [Check("tour-knows-only-iguide")]
    static void TourKnowsOnlyIGuide()
    {
        var making = MakingMethod(typeof(Tour), typeof(IGuide));
        OperationWrittenOnce(typeof(Tour), "Play", typeof(FamilyTour), typeof(ExpertTour));
        NamesNoMadeClass("Tour", typeof(IGuide));
        MakesItsOwn(making, typeof(FamilyTour), typeof(StoryGuide));
        MakesItsOwn(making, typeof(ExpertTour), typeof(ExpertGuide));
    }
}
