using System.Reflection;
using DesignPatterns.Checks;

static class PcConfiguratorChecks
{
    // Calls a pick on the configurator. A pick may return nothing or the configurator, so both styles pass.
    static void Pick(PcConfigurator pc, string name, params object[] args)
    {
        var method = typeof(PcConfigurator).GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m =>
            m.Name == name && m.GetParameters().Select(p => p.ParameterType).SequenceEqual(args.Select(a => a.GetType())));
        var shown = $"{name}({string.Join(", ", args.Select(a => a is int ? "int" : "string"))})";
        if (method is null) Expect.Fail("missingPick", new { pick = shown });
        try
        {
            method.Invoke(pc, args);
        }
        catch (TargetInvocationException e)
        {
            Expect.Fail("pickThrew", new { pick = shown, message = e.InnerException?.Message });
        }
    }

    // "rejected" when Confirm() throws an InvalidOperationException, otherwise the summary.
    static string Outcome(PcConfigurator pc)
    {
        try { return pc.Confirm().Summary(); }
        catch (InvalidOperationException) { return "rejected"; }
    }

    [Check("confirm-sums-up-the-pc")]
    static void ConfirmSumsUpThePc()
    {
        var pc = new PcConfigurator();
        Pick(pc, "Cpu", "Ryzen 5 7600", "AM5");
        Pick(pc, "Board", "B650 Tomahawk", "AM5");
        Pick(pc, "Memory", 32);
        var chosen = Outcome(pc);

        var basic = new PcConfigurator();
        Pick(basic, "Cpu", "Core i5-14400", "LGA1700");
        Pick(basic, "Board", "B760M Pro", "LGA1700");
        var standard = Outcome(basic);

        Expect.That(chosen == "Ryzen 5 7600 on B650 Tomahawk, AM5, 32 GB", "wrongSummary", new { actual = chosen });
        Expect.That(standard == "Core i5-14400 on B760M Pro, LGA1700, 8 GB", "wrongDefaultMemory", new { actual = standard });
    }

    [Check("picks-in-any-order")]
    static void PicksInAnyOrder()
    {
        var pc = new PcConfigurator();
        Pick(pc, "Memory", 16);
        Pick(pc, "Board", "B650 Tomahawk", "AM5");
        Pick(pc, "Cpu", "Core i5-14400", "LGA1700");
        Pick(pc, "Cpu", "Ryzen 7 7700", "AM5");
        var summary = Outcome(pc);

        Expect.That(summary == "Ryzen 7 7700 on B650 Tomahawk, AM5, 16 GB", "wrongOrder", new { actual = summary });
    }

    [Check("confirm-rejects-parts-that-do-not-fit")]
    static void ConfirmRejectsPartsThatDoNotFit()
    {
        var mixed = new PcConfigurator();
        Pick(mixed, "Cpu", "Core i5-14400", "LGA1700");
        Pick(mixed, "Board", "B650 Tomahawk", "AM5");

        var noCpu = new PcConfigurator();
        Pick(noCpu, "Board", "B650 Tomahawk", "AM5");

        var noBoard = new PcConfigurator();
        Pick(noBoard, "Cpu", "Ryzen 5 7600", "AM5");
        Pick(noBoard, "Memory", 16);

        var mixedOutcome = Outcome(mixed);
        Expect.That(mixedOutcome == "rejected", "mixedAccepted", new { actual = mixedOutcome });
        var noCpuOutcome = Outcome(noCpu);
        var noBoardOutcome = Outcome(noBoard);
        Expect.That(noCpuOutcome == "rejected" && noBoardOutcome == "rejected", "missingPartAccepted",
            new { noCpu = noCpuOutcome, noBoard = noBoardOutcome });
    }

    [Check("confirmed-pcs-stay-the-same")]
    static void ConfirmedPcsStayTheSame()
    {
        var pc = new PcConfigurator();
        Pick(pc, "Cpu", "Ryzen 5 7600", "AM5");
        Pick(pc, "Board", "B650 Tomahawk", "AM5");
        var first = pc.Confirm();
        Pick(pc, "Memory", 64);
        Pick(pc, "Cpu", "Ryzen 9 7950X", "AM5");
        var second = pc.Confirm();

        Expect.That(first.Summary() == "Ryzen 5 7600 on B650 Tomahawk, AM5, 8 GB", "firstChanged", new { actual = first.Summary() });
        Expect.That(second.Summary() == "Ryzen 9 7950X on B650 Tomahawk, AM5, 64 GB", "wrongSecond", new { actual = second.Summary() });
    }

    [Check("pcs-only-through-confirm")]
    static void PcsOnlyThroughConfirm()
    {
        Expect.That(typeof(Computer).GetConstructors(BindingFlags.Instance | BindingFlags.Public).Length == 0, "publicConstructor");
    }
}
