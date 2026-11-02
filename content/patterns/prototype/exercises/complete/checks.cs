using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SurveyChecks
{
    // A kind of survey the program has never seen. It counts its copies and remembers the last one.
    sealed class TestSurvey : ISurvey
    {
        public string Title { get; set; } = "Test survey";
        public List<string> Questions { get; } = [];
        public Footer Footer { get; } = new("test footer");
        public int Copies { get; private set; }
        public TestSurvey? LastCopy { get; private set; }

        public string Describe() => $"{Title}: test";

        public ISurvey Clone()
        {
            Copies++;
            LastCopy = new TestSurvey { Title = Title };
            return LastCopy;
        }
    }

    // One survey of each kind, already set up with questions and a footer.
    static ISurvey[] Samples()
    {
        var rating = new RatingSurvey("Canteen survey", 10);
        rating.Questions.Add("How was the soup?");
        rating.Questions.Add("How friendly was the staff?");
        rating.Footer.Text = "Enjoy your meal!";

        var yesNo = new YesNoSurvey("Team trip");
        yesNo.Questions.Add("Can you come on Friday?");
        yesNo.Footer.Text = "Thanks for replying!";

        return [rating, yesNo];
    }

    [Check("copies-keep-their-kind")]
    static void CopiesKeepTheirKind()
    {
        foreach (var survey in Samples())
        {
            var type = survey.GetType().Name;
            var copy = survey.Clone();
            Expect.That(copy is not null && !ReferenceEquals(copy, survey), "sameObject", new { type });
            Expect.That(copy!.GetType() == survey.GetType(), "wrongKind", new { type, actual = copy.GetType().Name });
            Expect.That(copy.Describe() == survey.Describe(), "differentCopy",
                new { type, expected = survey.Describe(), actual = copy.Describe() });
        }
    }

    [Check("copies-are-independent")]
    static void CopiesAreIndependent()
    {
        foreach (var survey in Samples())
        {
            var type = survey.GetType().Name;
            var before = survey.Describe();
            var copy = survey.Clone();

            copy.Questions.Add("Anything else?");
            Expect.That(survey.Describe() == before, "sharedQuestions", new { type, actual = survey.Describe() });

            copy.Footer.Text = "Goodbye!";
            Expect.That(survey.Describe() == before, "sharedFooter", new { type, actual = survey.Describe() });
        }
    }

    [Check("reuse-renames-only-the-copy")]
    static void ReuseRenamesOnlyTheCopy()
    {
        foreach (var survey in Samples())
        {
            var type = survey.GetType().Name;
            var before = survey.Describe();
            var reused = new SurveyDesk().Reuse(survey, "Second round");

            Expect.That(survey.Title != "Second round" && survey.Describe() == before, "originalChanged",
                new { type, actual = survey.Describe() });
            Expect.That(reused is not null && !ReferenceEquals(reused, survey), "sameObject", new { type });
            Expect.That(reused!.GetType() == survey.GetType(), "wrongKind", new { type, actual = reused.GetType().Name });
            Expect.That(reused.Title == "Second round", "notRenamed", new { type, actual = reused.Title });
            Expect.That(reused.Questions.SequenceEqual(survey.Questions) && reused.Footer.Text == survey.Footer.Text, "lostContent",
                new { type, actual = reused.Describe() });
        }
    }

    [Check("reuse-works-for-any-survey")]
    static void ReuseWorksForAnySurvey()
    {
        var survey = new TestSurvey();
        var reused = new SurveyDesk().Reuse(survey, "Renamed");

        Expect.That(survey.Copies == 1, "notCopiedOnce", new { copies = survey.Copies });
        Expect.That(ReferenceEquals(reused, survey.LastCopy), "notTheCopy");
        Expect.That(survey.Title == "Test survey", "testOriginalRenamed", new { actual = survey.Title });
    }

    [Check("desk-names-no-survey-class")]
    static void DeskNamesNoSurveyClass()
    {
        var classes = typeof(ISurvey).Assembly.GetTypes()
            .Where(t => t.IsClass && typeof(ISurvey).IsAssignableFrom(t) && t.DeclaringType != typeof(SurveyChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "SurveyDesk"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "deskNamesSurveyClass", new { type = named });
        }
    }
}
