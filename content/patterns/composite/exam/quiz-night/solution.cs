var pictures = new Round("Picture joker", 2);
pictures.Add(new Question("Whose dog is this?", 1));
pictures.Add(new Question("Which city is this skyline?", 2));

var music = new Round("Music", 1);
music.Add(new Question("Name the band", 2));
music.Add(pictures);

var night = new Round("Tuesday quiz", 1);
night.Add(new Question("Capital of Peru?", 1));
night.Add(music);

IQuizPart quiz = night;
Console.WriteLine($"{quiz.QuestionCount()} questions, up to {quiz.MaxPoints()} points");

// Any part of a quiz night: one question, or a round of questions and rounds.
public interface IQuizPart
{
    int MaxPoints();
    int QuestionCount();
}

// A question answers for itself.
public class Question(string text, int points) : IQuizPart
{
    public string Text => text;
    public int MaxPoints() => points;
    public int QuestionCount() => 1;
}

// A round asks every part in it and combines the answers; a joker round multiplies its points.
public class Round(string name, int factor) : IQuizPart
{
    private readonly List<IQuizPart> parts = [];

    public string Name => name;

    public void Add(IQuizPart part) => parts.Add(part);

    public int MaxPoints() => factor * parts.Sum(p => p.MaxPoints());

    public int QuestionCount() => parts.Sum(p => p.QuestionCount());
}
