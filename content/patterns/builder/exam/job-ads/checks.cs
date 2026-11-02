using System.Reflection;
using System.Runtime.CompilerServices;
using DesignPatterns.Checks;

static class JobAdChecks
{
    // Calls a choice on the draft. A choice may return nothing or the draft, so both styles pass.
    static void Choose(AdDraft draft, string name, params object[] args)
    {
        var method = typeof(AdDraft).GetMethods(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(m =>
            m.Name == name && m.GetParameters().Select(p => p.ParameterType).SequenceEqual(args.Select(a => a.GetType())));
        var shown = $"{name}({string.Join(", ", args.Select(a => a is int ? "int" : "string"))})";
        if (method is null) Expect.Fail("missingChoice", new { choice = shown });
        try
        {
            method.Invoke(draft, args);
        }
        catch (TargetInvocationException e)
        {
            Expect.Fail("choiceThrew", new { choice = shown, message = e.InnerException?.Message });
        }
    }

    // "rejected" when Post() throws an InvalidOperationException, otherwise the ad's text.
    static string Outcome(AdDraft draft)
    {
        try { return draft.Post().Text(); }
        catch (InvalidOperationException) { return "rejected"; }
    }

    [Check("ad-text-shows-the-choices")]
    static void AdTextShowsTheChoices()
    {
        var tester = new AdDraft("Junior tester");
        Choose(tester, "City", "Iasi");
        Choose(tester, "Salary", 2800, 3400);
        Choose(tester, "Skill", "Selenium");
        Choose(tester, "Skill", "SQL");
        var full = Outcome(tester);

        var analyst = new AdDraft("Data analyst");
        Choose(analyst, "Remote");
        var remote = Outcome(analyst);

        var designer = new AdDraft("Designer");
        Choose(designer, "Remote");
        Choose(designer, "City", "Brasov");
        var based = Outcome(designer);

        Expect.That(full == "Junior tester | Iasi | 2800-3400 | skills: Selenium, SQL", "wrongFull", new { actual = full });
        Expect.That(remote == "Data analyst | remote", "wrongRemote", new { actual = remote });
        Expect.That(based == "Designer | remote, based in Brasov", "wrongBased", new { actual = based });
    }

    [Check("choices-in-any-order")]
    static void ChoicesInAnyOrder()
    {
        var draft = new AdDraft("Night nurse");
        Choose(draft, "Skill", "triage");
        Choose(draft, "Salary", 3000, 3500);
        Choose(draft, "City", "Sibiu");
        Choose(draft, "Skill", "first aid");
        Choose(draft, "Salary", 3200, 3900);
        var text = Outcome(draft);

        Expect.That(text == "Night nurse | Sibiu | 3200-3900 | skills: triage, first aid", "wrongOrder", new { actual = text });
    }

    [Check("post-rejects-incomplete-ads")]
    static void PostRejectsIncompleteAds()
    {
        var nowhere = new AdDraft("Baker");
        Choose(nowhere, "Salary", 2500, 2900);
        var nowhereOutcome = Outcome(nowhere);

        var upsideDown = new AdDraft("Baker");
        Choose(upsideDown, "Salary", 2900, 2500);
        Choose(upsideDown, "City", "Arad");
        var upsideDownOutcome = Outcome(upsideDown);

        var equal = new AdDraft("Baker");
        Choose(equal, "Salary", 2700, 2700);
        Choose(equal, "Remote");
        var equalOutcome = Outcome(equal);

        Expect.That(nowhereOutcome == "rejected", "noPlaceAccepted", new { actual = nowhereOutcome });
        Expect.That(upsideDownOutcome == "rejected", "salaryAccepted", new { actual = upsideDownOutcome });
        Expect.That(equalOutcome == "Baker | remote | 2700-2700", "equalSalaryRejected", new { actual = equalOutcome });
    }

    [Check("posted-ads-stay-the-same")]
    static void PostedAdsStayTheSame()
    {
        var draft = new AdDraft("Junior tester");
        Choose(draft, "City", "Iasi");
        Choose(draft, "Skill", "Selenium");
        var first = draft.Post();
        Choose(draft, "Skill", "SQL");
        Choose(draft, "Remote");
        var second = draft.Post();

        Expect.That(first.Text() == "Junior tester | Iasi | skills: Selenium", "firstChanged", new { actual = first.Text() });
        Expect.That(second.Text() == "Junior tester | remote, based in Iasi | skills: Selenium, SQL", "wrongSecond", new { actual = second.Text() });
    }

    [Check("preset-adds-to-any-draft")]
    static void PresetAddsToAnyDraft()
    {
        var draft = new AdDraft("Graduate developer");
        Choose(draft, "City", "Cluj");
        Choose(draft, "Skill", "Git");
        Presets.Graduate(draft);
        Choose(draft, "Skill", "Docker");
        var text = Outcome(draft);

        Expect.That(text == "Graduate developer | remote, based in Cluj | 30000-36000 | skills: Git, C#, SQL, Docker", "wrongPreset", new { actual = text });
    }

    [Check("ads-are-read-only")]
    static void AdsAreReadOnly()
    {
        var type = typeof(JobAd);
        var setter = type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
            .FirstOrDefault(p => p.SetMethod is { IsPublic: true } s &&
                !s.ReturnParameter.GetRequiredCustomModifiers().Contains(typeof(IsExternalInit)));
        Expect.That(setter is null, "publicSetter", new { member = setter?.Name });

        var field = type.GetFields(BindingFlags.Instance | BindingFlags.Public).FirstOrDefault(f => !f.IsInitOnly);
        Expect.That(field is null, "publicField", new { member = field?.Name });
    }
}
