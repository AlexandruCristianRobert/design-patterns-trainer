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

    // ---- Exam Questions ----
    static readonly string[] Roles = ["Observer", "Subject", "Publisher"];
    const string WrongSolution = "public class Greeter { public string Greet() => \"\"; }";
    const string GreetsText = "title: t\nscenario: s\nchecks:\n  greets:\n    title: G\n";

    static ExamQuestionFiles MakeExam(string solution = Good, string checks = Checks, string? enText = Text,
        Contract? contract = null, string patternName = "Observer", string[]? roles = null)
    {
        var texts = new Dictionary<string, string>();
        if (enText is not null) texts["en"] = WriteText("en", enText);
        return new ExamQuestionFiles("p", "q", 1, contract ?? GreeterContract, solution, checks, texts, roles ?? Roles, patternName);
    }

    static Task<ValidationResult> ValidateExam(ExamQuestionFiles q) => ContentValidator.ValidateExamQuestionAsync(q);

    [Fact] public async Task Exam_Baseline_IsValid()
    {
        var r = await ValidateExam(MakeExam());
        Assert.Empty(r.Errors);
        Assert.Empty(r.Warnings);
    }

    [Fact] public async Task Exam_SolutionFailingACheck_IsError_AndSourcePrefixed()
    {
        var r = await ValidateExam(MakeExam(solution: WrongSolution));
        Assert.Contains(r.Errors, e => e.Contains("solution fails check 'greets'"));
        Assert.All(r.Errors, e => Assert.StartsWith("p/exam/q: ", e));
    }

    [Fact] public async Task Exam_ZeroChecks_IsError()
    {
        var r = await ValidateExam(MakeExam(checks: "static class C { }"));
        Assert.Contains(r.Errors, e => e.Contains("no checks"));
    }

    [Fact] public async Task Exam_MissingCheckTitle_IsError()
    {
        var r = await ValidateExam(MakeExam(enText: "title: t\nscenario: s\n"));
        Assert.Contains(r.Errors, e => e.Contains("missing title for check 'greets'"));
    }

    [Fact] public async Task Exam_StarterThatPassesEveryCheck_IsError()
    {
        var checks = """
            using DesignPatterns.Checks;
            static class C { [Check("greets")] static void G() => Expect.Equal(1, 1); }
            """;
        var r = await ValidateExam(MakeExam(solution: "", checks: checks, contract: new Contract([])));
        Assert.Contains(r.Errors, e => e.Contains("EXAM_STARTER already passes every check"));
    }

    [Fact] public async Task Exam_ScenarioNamingARole_IsError()
    {
        var r = await ValidateExam(MakeExam(enText: "title: t\nscenario: The subject tells everyone.\nchecks:\n  greets:\n    title: G\n"));
        Assert.Contains(r.Errors, e => e.Contains("scenario names a Pattern role: subject"));
    }

    [Fact] public async Task Exam_TitleNamingThePattern_IsError()
    {
        var r = await ValidateExam(MakeExam(enText: "title: An Observer\nscenario: s\nchecks:\n  greets:\n    title: G\n"));
        Assert.Contains(r.Errors, e => e.Contains("title names a Pattern role: Observer"));
    }

    [Fact] public async Task Exam_RoleInsideMemberName_IsError()
    {
        var contract = new Contract([new ContractType("Greeter", ContractTypeKind.Class, ["string Greet()", "void AddPublisher()"])]);
        var solution = "public class Greeter { public string Greet() => \"Hello\"; public void AddPublisher() { } }";
        var r = await ValidateExam(MakeExam(solution: solution, contract: contract));
        Assert.Contains(r.Errors, e => e.Contains("contract names a Pattern role: Publisher") && e.Contains("AddPublisher"));
    }

    [Fact] public async Task Exam_WholeWordsOnly_ObservableIsNotObserver()
    {
        var contract = new Contract([new ContractType("Observable", ContractTypeKind.Class, ["string Greet()"])]);
        var solution = "public class Observable { public string Greet() => \"Hello\"; }";
        var r = await ValidateExam(MakeExam(solution: solution, checks: Checks.Replace("Greeter", "Observable"), contract: contract));
        Assert.Empty(r.Errors);
    }

    [Fact] public async Task Exam_RoleOnlyAsSubstring_IsNotFlagged()
    {
        var contract = new Contract([new ContractType("Greeter", ContractTypeKind.Class, ["string Greet()", "int SubjectiveScore()"])]);
        var solution = "public class Greeter { public string Greet() => \"Hello\"; public int SubjectiveScore() => 1; }";
        var r = await ValidateExam(MakeExam(solution: solution, contract: contract, patternName: "Fixture", roles: ["Subject"],
            enText: "title: t\nscenario: A subjective judge scores it.\nchecks:\n  greets:\n    title: G\n"));
        Assert.Empty(r.Errors);
    }

    [Fact] public async Task Exam_AcronymSegment_IsFlagged()
    {
        var contract = new Contract([new ContractType("XMLObserver", ContractTypeKind.Class, ["string Greet()"])]);
        var solution = "public class XMLObserver { public string Greet() => \"Hello\"; }";
        var r = await ValidateExam(MakeExam(solution: solution, checks: Checks.Replace("Greeter", "XMLObserver"), contract: contract));
        Assert.Contains(r.Errors, e => e.Contains("contract names a Pattern role: Observer (type XMLObserver)"));
    }

    [Fact] public async Task Exam_PluralInScenario_IsFlagged()
    {
        var r = await ValidateExam(MakeExam(patternName: "Fixture", roles: ["Observer"],
            enText: "title: t\nscenario: Many observers wait.\nchecks:\n  greets:\n    title: G\n"));
        Assert.Contains(r.Errors, e => e.Contains("scenario names a Pattern role: observers"));
    }

    [Fact] public async Task Exam_YToIesPluralInScenario_IsFlagged()
    {
        var r = await ValidateExam(MakeExam(patternName: "Fixture", roles: ["Strategy"],
            enText: "title: t\nscenario: Swap the strategies at runtime.\nchecks:\n  greets:\n    title: G\n"));
        Assert.Contains(r.Errors, e => e.Contains("scenario names a Pattern role: strategies"));
    }

    [Fact] public async Task Exam_PluralInMember_IsFlagged()
    {
        var contract = new Contract([new ContractType("Greeter", ContractTypeKind.Class, ["string Greet()", "void NotifyObservers()"])]);
        var solution = "public class Greeter { public string Greet() => \"Hello\"; public void NotifyObservers() { } }";
        var r = await ValidateExam(MakeExam(solution: solution, contract: contract, patternName: "Fixture", roles: ["Observer"]));
        Assert.Contains(r.Errors, e => e.Contains("contract names a Pattern role: Observers") && e.Contains("NotifyObservers"));
        Assert.DoesNotContain(r.Errors, e => e.Contains("Notify (") || e.Contains("role: Notify"));
    }

    [Fact] public void ExamListing_DuplicateIdIsReported()
    {
        var root = Directory.CreateTempSubdirectory("content-tests").FullName;
        var pat = Path.Combine(root, "patterns", "p");
        Directory.CreateDirectory(Path.Combine(pat, "exam", "a"));
        File.WriteAllText(Path.Combine(pat, "pattern.yaml"), "id: p\nexamQuestions: [a, a]\n");
        var e = Assert.Single(ContentValidator.ValidateExamListing(root));
        Assert.Contains("'a' more than once", e);
    }

    [Fact] public void ExamListing_UnparseablePatternYaml_IsReported()
    {
        var root = Directory.CreateTempSubdirectory("content-tests").FullName;
        var pat = Path.Combine(root, "patterns", "p");
        Directory.CreateDirectory(pat);
        File.WriteAllText(Path.Combine(pat, "pattern.yaml"), "examQuestions: [a\n  : : bad");
        Assert.Contains(ContentValidator.ValidateExamListing(root), e => e.StartsWith("p: cannot read pattern.yaml"));
    }

    [Fact] public async Task Exam_PatternNameIsBannedEvenWithoutRoleNames()
    {
        var contract = new Contract([new ContractType("StockObserver", ContractTypeKind.Class, ["string Greet()"])]);
        var r = await ValidateExam(MakeExam(contract: contract, roles: []));
        Assert.Contains(r.Errors, e => e.Contains("contract names a Pattern role: Observer (type StockObserver)"));
    }

    [Fact] public async Task Exam_MultiWordPatternName_MatchesAsAPhrase()
    {
        var r = await ValidateExam(MakeExam(patternName: "ChainOfResponsibility", roles: [],
            enText: "title: t\nscenario: Build a chain of responsibility.\nchecks:\n  greets:\n    title: G\n"));
        Assert.Contains(r.Errors, e => e.Contains("scenario names a Pattern role: chain of responsibility"));
    }

    [Fact] public void ExamListing_MismatchIsReported()
    {
        var root = Directory.CreateTempSubdirectory("content-tests").FullName;
        var pat = Path.Combine(root, "patterns", "p");
        Directory.CreateDirectory(Path.Combine(pat, "exam", "on-disk-only"));
        Directory.CreateDirectory(Path.Combine(pat, "exam", "both"));
        File.WriteAllText(Path.Combine(pat, "pattern.yaml"), "id: p\nexamQuestions: [both, listed-only]\n");
        var errors = ContentValidator.ValidateExamListing(root);
        Assert.Contains(errors, e => e.Contains("'listed-only'") && e.Contains("does not exist"));
        Assert.Contains(errors, e => e.Contains("on-disk-only") && e.Contains("not in examQuestions"));
        Assert.Equal(2, errors.Count);
    }

    [Fact] public async Task Exam_LoadFailure_BecomesValidationError()
    {
        var root = Directory.CreateTempSubdirectory("content-tests").FullName;
        var dir = Path.Combine(root, "patterns", "p", "exam", "broken");
        Directory.CreateDirectory(dir);
        File.WriteAllText(Path.Combine(dir, "question.yaml"), "version: 1\ncontract:\n  types:\n    - { name: A, kind: bogus, members: [] }\n");
        var q = Assert.Single(ContentLocator.ExamQuestions(root));
        var r = await ValidateExam(q);
        Assert.Contains(r.Errors, e => e.StartsWith("p/exam/broken: ") && e.Contains("bogus"));
    }
}
