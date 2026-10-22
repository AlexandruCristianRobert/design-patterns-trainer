namespace DesignPatterns.Content.Tests;

[Collection(ConsoleCaptureCollection.Name)]
public class ValidatorTests
{
    static readonly string FixtureRoot = Path.Combine(AppContext.BaseDirectory, "Fixtures", "content");

    static Task<ValidationResult> Validate(string exerciseId) =>
        ContentValidator.ValidateAsync(ContentLocator.Exercises(FixtureRoot).Single(e => e.ExerciseId == exerciseId));

    [Fact] public async Task Good_HasNoErrors() => Assert.Empty((await Validate("good")).Errors);

    [Fact] public async Task BadStarter_ReportsStarterPassing()
    {
        var r = await Validate("bad-starter");
        Assert.Contains(r.Errors, e => e.Contains("starter"));
    }

    [Fact] public async Task BadSolution_NamesFailingCheck()
    {
        var r = await Validate("bad-solution");
        Assert.Contains(r.Errors, e => e.Contains("greets"));
    }

    [Fact] public async Task MissingText_NamesCheckAndReason()
    {
        var r = await Validate("missing-text");
        Assert.Equal(2, r.Errors.Count);
        Assert.Contains(r.Errors, e => e.Contains("second"));
        Assert.Contains(r.Errors, e => e.Contains("wrongGreeting"));
    }

    [Fact] public void Locator_ReadsExerciseFiles()
    {
        var ex = ContentLocator.Exercises(FixtureRoot).Single(e => e.ExerciseId == "good");
        Assert.Equal(("fixture", "complete", 1), (ex.PatternId, ex.Kind, ex.Version));
        var t = Assert.Single(ex.Contract.Types);
        Assert.Equal(("Greeter", DesignPatterns.Core.Contracts.ContractTypeKind.Class), (t.Name, t.Kind));
        Assert.True(ex.TextEnPathsByLocale.ContainsKey("en"));
    }

    [Fact] public void ContentRoot_Exists() => Assert.True(Directory.Exists(ContentLocator.Root));
}
