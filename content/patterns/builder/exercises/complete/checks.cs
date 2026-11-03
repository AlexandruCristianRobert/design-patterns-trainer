using System.Reflection;
using System.Runtime.CompilerServices;
using DesignPatterns.Checks;

static class BouquetChecks
{
    // Calls a step on the builder. A step may return nothing or the builder, so both styles pass;
    // when it returns a builder, the next step goes to that one.
    static BouquetBuilder Step(BouquetBuilder builder, string name, params object[] args)
    {
        var method = typeof(BouquetBuilder).GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m =>
            m.Name == name && m.GetParameters().Select(p => p.ParameterType).SequenceEqual(args.Select(a => a.GetType())));
        var shown = $"{name}({string.Join(", ", args.Select(a => a is int ? "int" : "string"))})";
        if (method is null) Expect.Fail("missingStep", new { step = shown });
        try
        {
            return method.Invoke(builder, args) as BouquetBuilder ?? builder;
        }
        catch (TargetInvocationException e)
        {
            Expect.Fail("stepThrew", new { step = shown, message = e.InnerException?.Message });
            throw;
        }
    }

    // "rejected" when Build() throws an InvalidOperationException, otherwise what the bouquet describes.
    static string Outcome(BouquetBuilder builder)
    {
        try { return builder.Build().Describe(); }
        catch (InvalidOperationException) { return "rejected"; }
    }

    [Check("steps-make-the-bouquet")]
    static void StepsMakeTheBouquet()
    {
        var full = new BouquetBuilder();
        full = Step(full, "AddStems", "rose", 3);
        full = Step(full, "AddStems", "tulip", 2);
        full = Step(full, "WithRibbon", "red");
        full = Step(full, "InVase");
        var bouquet = full.Build();

        var plain = Step(new BouquetBuilder(), "AddStems", "lily", 1).Build();

        Expect.That(bouquet.Describe() == "rose x3, tulip x2, red ribbon, in a vase", "wrongFull", new { expected = "rose x3, tulip x2, red ribbon, in a vase", actual = bouquet.Describe() });
        Expect.That(bouquet.StemCount == 5, "wrongCount", new { count = bouquet.StemCount });
        Expect.That(plain.Describe() == "lily x1", "wrongPlain", new { expected = "lily x1", actual = plain.Describe() });
    }

    [Check("steps-in-any-order")]
    static void StepsInAnyOrder()
    {
        var builder = new BouquetBuilder();
        builder = Step(builder, "InVase");
        builder = Step(builder, "WithRibbon", "white");
        builder = Step(builder, "AddStems", "iris", 4);
        builder = Step(builder, "AddStems", "fern", 2);
        var described = builder.Build().Describe();

        Expect.That(described == "iris x4, fern x2, white ribbon, in a vase", "wrongOrder", new { expected = "iris x4, fern x2, white ribbon, in a vase", actual = described });
    }

    [Check("build-rejects-bad-bouquets")]
    static void BuildRejectsBadBouquets()
    {
        var empty = Outcome(new BouquetBuilder());
        var ribbonOnly = Outcome(Step(new BouquetBuilder(), "WithRibbon", "blue"));
        var fourInVase = Outcome(Step(Step(new BouquetBuilder(), "AddStems", "rose", 4), "InVase"));
        var fiveInVase = Outcome(Step(Step(Step(new BouquetBuilder(), "InVase"), "AddStems", "rose", 3), "AddStems", "daisy", 2));

        Expect.That(empty == "rejected" && ribbonOnly == "rejected", "noStemsAccepted", new { empty, ribbonOnly });
        Expect.That(fourInVase == "rejected", "smallVaseAccepted", new { expected = "rejected", actual = fourInVase });
        Expect.That(fiveInVase == "rose x3, daisy x2, in a vase", "fiveInVaseRejected", new { expected = "rose x3, daisy x2, in a vase", actual = fiveInVase });
    }

    [Check("later-steps-leave-bouquets-alone")]
    static void LaterStepsLeaveBouquetsAlone()
    {
        var builder = Step(new BouquetBuilder(), "AddStems", "peony", 3);
        var first = builder.Build();
        builder = Step(builder, "AddStems", "rose", 2);
        builder = Step(builder, "WithRibbon", "gold");
        builder = Step(builder, "InVase");
        var second = builder.Build();

        Expect.That(first.Describe() == "peony x3" && first.StemCount == 3, "firstChanged",
            new { actual = first.Describe(), count = first.StemCount });
        Expect.That(second.Describe() == "peony x3, rose x2, gold ribbon, in a vase", "wrongSecond", new { expected = "peony x3, rose x2, gold ribbon, in a vase", actual = second.Describe() });
    }

    [Check("bouquet-is-read-only")]
    static void BouquetIsReadOnly()
    {
        var type = typeof(Bouquet);
        var setter = type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .FirstOrDefault(p => p.SetMethod is { IsPublic: true } s &&
                !s.ReturnParameter.GetRequiredCustomModifiers().Contains(typeof(IsExternalInit)));
        Expect.That(setter is null, "publicSetter", new { member = setter?.Name });

        var field = type.GetFields(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(f => !f.IsInitOnly);
        Expect.That(field is null, "publicField", new { member = field?.Name });
    }
}
