using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class FestivalStageChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // The method `maker` declares that returns a `made`: it takes no parameters, the code that uses `maker` can call it, and each subtype can fill it in.
    static MethodInfo MakingMethod(Type maker, Type made)
    {
        var found = maker.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { maker = maker.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Length == 0);
        if (method is null) Expect.Fail("makingMethodParameters", new { maker = maker.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { maker = maker.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsAssembly || method.IsFamilyOrAssembly, "makingMethodHidden", new { maker = maker.Name, method = method.Name });
        return method;
    }

    // The source of `user` names none of the program's classes that implement or derive from any of `kinds`.
    static void NamesNoConcreteClass(string user, params Type[] kinds)
    {
        var classes = kinds[0].Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(FestivalStageChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == user))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "userNamesConcreteClass", new { user, type = named });
        }
    }

    // `hire` hires out a new `speaker` and new `lights` on every call, all from one kind of stage.
    static void HiresOneSet(StageHire hire, Type speaker, Type lights)
    {
        var name = hire.GetType().Name;
        var first = hire.HireSpeaker();
        var second = hire.HireSpeaker();
        Expect.That(first?.GetType() == speaker, "wrongSpeaker", new { type = name, expected = speaker.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesSpeaker", new { type = name });
        var firstLights = hire.HireLights();
        var secondLights = hire.HireLights();
        Expect.That(firstLights?.GetType() == lights, "wrongLights", new { type = name, expected = lights.Name, actual = firstLights?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(firstLights, secondLights), "reusesLights", new { type = name });
    }

    [Check("gear-describes-itself")]
    static void GearDescribesItself()
    {
        ISpeaker stack = new StackSpeaker();
        ISpeaker wedge = new WedgeSpeaker();
        var speakers = $"{stack.Name} {stack.Watts} / {wedge.Name} {wedge.Watts}";
        var lights = $"{((ILights)new StrobeLights()).Name} / {((ILights)new WarmSpotlights()).Name}";

        Expect.That(speakers == "speaker stack 5000 / wedge monitor 800", "wrongSpeakers", new { actual = speakers });
        Expect.That(lights == "strobes / warm spotlights", "wrongLightNames", new { actual = lights });
    }

    [Check("rock-hire-sends-rock-gear")]
    static void RockHireSendsRockGear()
    {
        HiresOneSet(new RockHire(), typeof(StackSpeaker), typeof(StrobeLights));
    }

    [Check("acoustic-hire-sends-acoustic-gear")]
    static void AcousticHireSendsAcousticGear()
    {
        HiresOneSet(new AcousticHire(), typeof(WedgeSpeaker), typeof(WarmSpotlights));
    }

    [Check("soundcheck-uses-the-stage-hire")]
    static void SoundcheckUsesTheStageHire()
    {
        var rock = new Stage(new RockHire()).Soundcheck("The Foxes");
        var acoustic = new Stage(new AcousticHire()).Soundcheck("Lena Moor");

        Expect.That(rock == "The Foxes: speaker stack, 5000 W, strobes, ear plugs handed out", "wrongRock", new { actual = rock });
        Expect.That(acoustic == "Lena Moor: wedge monitor, 800 W, warm spotlights", "wrongAcoustic", new { actual = acoustic });
    }

    [Check("stage-knows-only-the-hire")]
    static void StageKnowsOnlyTheHire()
    {
        var maker = typeof(StageHire);
        Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { maker = maker.Name });
        MakingMethod(maker, typeof(ISpeaker));
        MakingMethod(maker, typeof(ILights));
        NamesNoConcreteClass("Stage", typeof(ISpeaker), typeof(ILights), maker);
    }
}
