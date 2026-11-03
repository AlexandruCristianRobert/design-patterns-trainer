using System.Reflection;
using DesignPatterns.Checks;

static class GroomingChecks
{
    static Type BuilderType() => Code.Type("GroomingBuilder").Clr;

    // A new GroomingBuilder for the pet, made through its public constructor that takes the pet's name.
    static object NewBuilder(string pet)
    {
        var constructor = BuilderType().GetConstructor([typeof(string)]);
        if (constructor is null) Expect.Fail("noPetConstructor");
        return constructor.Invoke([pet]);
    }

    // Calls a step on the builder. A step may return nothing or the builder, so both styles pass;
    // when it returns a builder, the next step goes to that one.
    static object Step(object builder, string name, params object[] args)
    {
        var method = BuilderType().GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m =>
            m.Name == name && m.GetParameters().Select(p => p.ParameterType).SequenceEqual(args.Select(a => a.GetType())));
        var shown = $"{name}({string.Join(", ", args.Select(_ => "string"))})";
        if (method is null) Expect.Fail("missingStep", new { step = shown });
        try
        {
            var result = method.Invoke(builder, args);
            return result is not null && BuilderType().IsInstanceOfType(result) ? result : builder;
        }
        catch (TargetInvocationException e)
        {
            Expect.Fail("stepThrew", new { step = shown, message = e.InnerException?.Message });
            throw;
        }
    }

    // Calls each named step in turn; "Haircut" takes the style that follows it.
    static object Steps(object builder, params string[] steps)
    {
        for (var i = 0; i < steps.Length; i++)
            builder = steps[i] == "Haircut" ? Step(builder, "Haircut", steps[++i]) : Step(builder, steps[i]);
        return builder;
    }

    // "rejected" when Build() throws an InvalidOperationException, otherwise what the visit describes.
    static string Outcome(object builder)
    {
        var build = BuilderType().GetMethod("Build", BindingFlags.Instance | BindingFlags.Public, Type.EmptyTypes);
        if (build is null || build.ReturnType != typeof(GroomingVisit)) Expect.Fail("noBuild");
        try
        {
            return ((GroomingVisit)build.Invoke(builder, null)!).Describe();
        }
        catch (TargetInvocationException e) when (e.InnerException is InvalidOperationException)
        {
            return "rejected";
        }
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Rex: bath, summer cut, bow",
            "Mia: nails",
            "Bruno: bath, nails, teeth",
            "Lola: rejected (A haircut needs a bath.)",
            "Tom: rejected (Nothing is booked.)",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("steps-book-the-services")]
    static void StepsBookTheServices()
    {
        var all = Outcome(Steps(NewBuilder("Kiki"), "Bath", "Nails", "Haircut", "puppy cut", "Teeth", "Bow"));
        var teeth = Outcome(Steps(NewBuilder("Odin"), "Teeth"));

        Expect.That(all == "Kiki: bath, nails, puppy cut, teeth, bow", "wrongAll", new { expected = "Kiki: bath, nails, puppy cut, teeth, bow", actual = all });
        Expect.That(teeth == "Odin: teeth", "wrongOne", new { expected = "Odin: teeth", actual = teeth });
    }

    [Check("steps-in-any-order")]
    static void StepsInAnyOrder()
    {
        var bowFirst = Outcome(Steps(NewBuilder("Pip"), "Bow", "Haircut", "teddy cut", "Bath"));
        var bathFirst = Outcome(Steps(NewBuilder("Pip"), "Bath", "Bow", "Haircut", "teddy cut"));

        Expect.That(bowFirst == "Pip: bath, teddy cut, bow", "wrongBowFirst", new { expected = "Pip: bath, teddy cut, bow", actual = bowFirst });
        Expect.That(bathFirst == "Pip: bath, teddy cut, bow", "wrongBathFirst", new { expected = "Pip: bath, teddy cut, bow", actual = bathFirst });
    }

    [Check("build-rejects-bad-visits")]
    static void BuildRejectsBadVisits()
    {
        var nothing = Outcome(NewBuilder("Ziggy"));
        var cutOnly = Outcome(Steps(NewBuilder("Ziggy"), "Haircut", "short", "Nails"));

        Expect.That(nothing == "rejected", "emptyAccepted", new { expected = "rejected", actual = nothing });
        Expect.That(cutOnly == "rejected", "cutWithoutBathAccepted", new { expected = "rejected", actual = cutOnly });
    }

    [Check("visits-come-from-the-builder")]
    static void VisitsComeFromTheBuilder()
    {
        var open = typeof(GroomingVisit).GetConstructors(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault();
        Expect.That(open is null, "publicConstructor");

        NewBuilder("Ziggy");
        Expect.That(BuilderType().GetMethod("Build", BindingFlags.Instance | BindingFlags.Public, Type.EmptyTypes)?.ReturnType == typeof(GroomingVisit),
            "noBuild");
    }
}
