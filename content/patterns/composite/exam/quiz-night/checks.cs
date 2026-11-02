using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class QuizNightChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Three levels: night (x1) holds a 1-point question and music; music (x1) holds two 2-point questions
    // and pictures; pictures (x2) holds a 1-point and a 3-point question.
    static (Round Night, Round Music) ThreeLevels()
    {
        var pictures = new Round("Pictures", 2);
        pictures.Add(new Question("Which bridge is this?", 1));
        pictures.Add(new Question("Who painted this?", 3));
        var music = new Round("Music", 1);
        music.Add(new Question("Name the singer", 2));
        music.Add(new Question("Name the year", 2));
        music.Add(pictures);
        var night = new Round("Night", 1);
        night.Add(new Question("Capital of Chile?", 1));
        night.Add(music);
        return (night, music);
    }

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("question-answers-for-itself")]
    static void QuestionAnswersForItself()
    {
        IQuizPart question = new Question("Longest river?", 3);

        Expect.That(question.MaxPoints() == 3 && question.QuestionCount() == 1, "wrongQuestion",
            new { points = question.MaxPoints(), count = question.QuestionCount() });
    }

    [Check("rounds-inside-rounds-add-up")]
    static void RoundsInsideRoundsAddUp()
    {
        var (night, music) = ThreeLevels();
        IQuizPart quiz = night;
        var (points, count) = (quiz.MaxPoints(), quiz.QuestionCount());
        music.Add(new Question("Name the album", 5));
        var (laterPoints, laterCount) = (quiz.MaxPoints(), quiz.QuestionCount());

        Expect.That(points == 13 && count == 5, "wrongNested", new { points, count });
        Expect.That(laterPoints == 18 && laterCount == 6, "missedLateQuestion", new { points = laterPoints, count = laterCount });
    }

    [Check("joker-rounds-multiply")]
    static void JokerRoundsMultiply()
    {
        var joker = new Round("Joker", 2);
        joker.Add(new Question("Tallest animal?", 2));
        joker.Add(new Question("Smallest planet?", 1));
        var bonus = new Round("Bonus", 3);
        bonus.Add(new Question("Fastest bird?", 2));
        var final = new Round("Final", 2);
        final.Add(bonus);
        final.Add(new Question("Oldest city?", 1));

        Expect.That(((IQuizPart)joker).MaxPoints() == 6 && ((IQuizPart)joker).QuestionCount() == 2, "wrongJoker",
            new { points = ((IQuizPart)joker).MaxPoints(), count = ((IQuizPart)joker).QuestionCount() });
        Expect.That(((IQuizPart)final).MaxPoints() == 14, "wrongJokerInJoker", new { points = ((IQuizPart)final).MaxPoints() });
    }

    [Check("empty-round-works")]
    static void EmptyRoundWorks()
    {
        IQuizPart empty = new Round("Tiebreak", 2);
        var (night, _) = ThreeLevels();
        night.Add(new Round("Tiebreak", 2));
        IQuizPart quiz = night;

        Expect.That(empty.MaxPoints() == 0 && empty.QuestionCount() == 0, "emptyNotZero", new { points = empty.MaxPoints(), count = empty.QuestionCount() });
        Expect.That(quiz.MaxPoints() == 13 && quiz.QuestionCount() == 5, "emptyChangedTotals", new { points = quiz.MaxPoints(), count = quiz.QuestionCount() });
    }

    [Check("questions-and-rounds-share-one-type")]
    static void QuestionsAndRoundsShareOneType()
    {
        Expect.That(typeof(IQuizPart).IsAssignableFrom(typeof(Question)), "questionNotAPart");
        Expect.That(typeof(IQuizPart).IsAssignableFrom(typeof(Round)), "roundNotAPart");

        var fields = typeof(Round).GetFields(Declared);
        Expect.That(fields.Any(f => Inside(f.FieldType).Contains(typeof(IQuizPart))), "noPartField");
        Expect.That(!fields.SelectMany(f => Inside(f.FieldType)).Contains(typeof(Question)), "roundHoldsQuestions");

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "Round"))
        {
            var mentions = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Any(n => n.Identifier.ValueText == "Question");
            Expect.That(!mentions, "roundNamesQuestion");
        }
    }
}
