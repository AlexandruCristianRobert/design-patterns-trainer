using Xunit.Abstractions;

namespace DesignPatterns.Content.Tests;

[Collection(ConsoleCaptureCollection.Name)]
public class ContentValidationTests(ITestOutputHelper output)
{
    public static IEnumerable<object?[]> Exercises()
    {
        var all = ContentLocator.Exercises(ContentLocator.Root).ToList();
        if (all.Count == 0) yield return [null]; // xUnit fails a Theory with no data
        foreach (var e in all) yield return [$"{e.PatternId}/{e.ExerciseId}"];
    }

    [Theory, MemberData(nameof(Exercises))]
    public async Task Exercise_IsValid(string? key)
    {
        if (key is null) return;
        var exercise = ContentLocator.Exercises(ContentLocator.Root).Single(e => $"{e.PatternId}/{e.ExerciseId}" == key);
        var result = await ContentValidator.ValidateAsync(exercise, ContentLocator.Locales(ContentLocator.Root));
        foreach (var w in result.Warnings) output.WriteLine("warning: " + w);
        Assert.Empty(result.Errors);
    }

    public static IEnumerable<object?[]> ExamQuestions()
    {
        var all = ContentLocator.ExamQuestions(ContentLocator.Root).ToList();
        if (all.Count == 0) yield return [null]; // Observer has no exam folder yet; xUnit fails a Theory with no data
        foreach (var q in all) yield return [$"{q.PatternId}/{q.QuestionId}"];
    }

    [Theory, MemberData(nameof(ExamQuestions))]
    public async Task ExamQuestion_IsValid(string? key)
    {
        if (key is null) return;
        var question = ContentLocator.ExamQuestions(ContentLocator.Root).Single(q => $"{q.PatternId}/{q.QuestionId}" == key);
        var result = await ContentValidator.ValidateExamQuestionAsync(question, ContentLocator.Locales(ContentLocator.Root));
        foreach (var w in result.Warnings) output.WriteLine("warning: " + w);
        Assert.Empty(result.Errors);
    }

    [Fact]
    public void ExamQuestionLists_MatchTheirDirectories() =>
        Assert.Empty(ContentValidator.ValidateExamListing(ContentLocator.Root));
}
