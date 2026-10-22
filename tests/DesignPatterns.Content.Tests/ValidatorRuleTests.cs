using DesignPatterns.Core.Contracts;

namespace DesignPatterns.Content.Tests;

[Collection(ConsoleCaptureCollection.Name)]
public class ValidatorRuleTests
{
    const string Good = "public class Greeter { public string Greet() => \"Hello\"; }";
    const string Stub = "public class Greeter { public string Greet() => \"\"; }";
    const string Checks = """
        using DesignPatterns.Checks;
        static class C { [Check("greets")] static void G() => Expect.Equal("Hello", new Greeter().Greet()); }
        """;
    const string Text = "title: t\nscenario: s\nhints: []\nchecks:\n  greets:\n    title: Greets\n";
    static readonly Contract GreeterContract = new([new ContractType("Greeter", ContractTypeKind.Class, ["string Greet()"])]);

    static string WriteText(string lng, string content)
    {
        var dir = Directory.CreateTempSubdirectory("content-tests").FullName;
        var path = Path.Combine(dir, $"text.{lng}.yaml");
        File.WriteAllText(path, content);
        return path;
    }

    static ExerciseFiles Make(string kind = "complete", string starter = Stub, string solution = Good, string checks = Checks,
        string? enText = Text, Contract? contract = null, Dictionary<string, string>? extraText = null)
    {
        var texts = extraText ?? [];
        if (enText is not null) texts["en"] = WriteText("en", enText);
        return new ExerciseFiles("p", "e", kind, 1, contract ?? GreeterContract, starter, solution, checks, texts);
    }

    [Fact] public async Task Baseline_IsValid()
    {
        var r = await ContentValidator.ValidateAsync(Make());
        Assert.Empty(r.Errors);
        Assert.Empty(r.Warnings);
    }

    [Fact] public async Task Messages_AreSourcePrefixed()
    {
        var r = await ContentValidator.ValidateAsync(Make(starter: Good));
        Assert.All(r.Errors, e => Assert.StartsWith("p/e: ", e));
    }

    [Fact] public async Task UnknownCheckIdInText_IsError()
    {
        var r = await ContentValidator.ValidateAsync(Make(enText: Text + "  ghost:\n    title: Ghost\n"));
        Assert.Contains(r.Errors, e => e.Contains("unknown check 'ghost'"));
    }

    [Fact] public async Task MissingEnText_IsError()
    {
        var r = await ContentValidator.ValidateAsync(Make(enText: null));
        Assert.Contains(r.Errors, e => e.Contains("text.en.yaml is missing"));
    }

    [Fact] public async Task ZeroChecks_IsError()
    {
        var r = await ContentValidator.ValidateAsync(Make(checks: "static class C { }"));
        Assert.Contains(r.Errors, e => e.Contains("no checks"));
    }

    [Fact] public async Task CompleteStarterThatDoesNotCompile_IsError()
    {
        var r = await ContentValidator.ValidateAsync(Make(starter: "public class Greeter { oops"));
        Assert.Contains(r.Errors, e => e.Contains("starter must compile"));
    }

    [Fact] public async Task BuildStarterThatDoesNotCompile_IsAccepted()
    {
        var r = await ContentValidator.ValidateAsync(Make(kind: "build", starter: "public class Greeter { oops"));
        Assert.Empty(r.Errors);
    }

    [Fact] public async Task UnknownKind_IsError()
    {
        var r = await ContentValidator.ValidateAsync(Make(kind: "weird"));
        Assert.Contains(r.Errors, e => e.Contains("unknown exercise kind"));
    }

    [Fact] public async Task SolutionThatDoesNotCompile_SkipsIdBasedTextErrors()
    {
        var r = await ContentValidator.ValidateAsync(Make(solution: "public class Greeter { oops", enText: Text + "  ghost:\n    title: G\n"));
        Assert.Contains(r.Errors, e => e.Contains("solution:"));
        Assert.DoesNotContain(r.Errors, e => e.Contains("ghost"));
    }

    [Fact] public async Task HangingCheck_TimesOut_AndLaterCheckStillValidates()
    {
        var checks = """
            using DesignPatterns.Checks;
            static class C {
                [Check("hang")] static void H() { while (true) { } }
                [Check("greets")] static void G() => Expect.Equal("Hello", new Greeter().Greet());
            }
            """;
        var text = Text + "  hang:\n    title: Hangs\n";
        var r = await ContentValidator.ValidateAsync(Make(checks: checks, enText: text));
        Assert.Contains(r.Errors, e => e.Contains("'hang'") && e.Contains("timed out"));
        Assert.DoesNotContain(r.Errors, e => e.Contains("'greets'"));
        Assert.Single(r.Errors, e => e.Contains("solution fails"));
    }

    [Fact] public async Task NonEnLocaleProblems_AreWarnings()
    {
        var de = new Dictionary<string, string> { ["de"] = WriteText("de", "title: t\nchecks: {}\n") };
        var r = await ContentValidator.ValidateAsync(Make(extraText: de));
        Assert.Empty(r.Errors);
        Assert.Contains(r.Warnings, w => w.Contains("text.de.yaml") && w.Contains("'greets'"));
    }

    [Fact] public async Task MissingExpectedLocaleFile_IsWarning()
    {
        var r = await ContentValidator.ValidateAsync(Make(), new HashSet<string> { "en", "de" });
        Assert.Empty(r.Errors);
        Assert.Contains(r.Warnings, w => w.Contains("text.de.yaml is missing"));
    }

    [Fact] public void Locales_AreCollectedAcrossContent()
    {
        var root = Path.Combine(AppContext.BaseDirectory, "Fixtures", "content");
        Assert.Contains("en", ContentLocator.Locales(root));
    }

    [Fact] public async Task LoadFailure_BecomesValidationError()
    {
        var root = Directory.CreateTempSubdirectory("content-tests").FullName;
        var dir = Path.Combine(root, "patterns", "p", "exercises", "broken");
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "exercise.yaml"), "kind: complete\nversion: 1\ncontract:\n  types:\n    - { name: A, kind: bogus, members: [] }\n");
        var ex = Assert.Single(ContentLocator.Exercises(root));
        var r = await ContentValidator.ValidateAsync(ex);
        Assert.Contains(r.Errors, e => e.StartsWith("p/broken: ") && e.Contains("bogus"));
    }
}
