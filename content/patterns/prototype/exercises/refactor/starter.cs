foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();
        var shop = new CardShop();

        var birthday = new BirthdayCard(30);
        birthday.Lines.Add("Happy birthday!");
        birthday.Lines.Add("Thirty looks good on you.");
        var forSam = shop.Copy(birthday);
        forSam.Lines.Add("Love, Sam");
        forSam.Envelope.Colour = "gold";
        Screen.Lines.Add(birthday.Describe());
        Screen.Lines.Add(forSam.Describe());

        var thanks = new ThankYouCard("the Popescus");
        thanks.Lines.Add("Thank you for the flowers.");
        var forAna = shop.Copy(thanks);
        forAna.Envelope.Colour = "green";
        Screen.Lines.Add(thanks.Describe());
        Screen.Lines.Add(forAna.Describe());

        return [.. Screen.Lines];
    }
}

// Collects what the program prints, so Demo.Run() can return it. Leave as is.
public static class Screen
{
    public static List<string> Lines { get; } = [];
}

// The envelope a card comes in. A card holds it as a separate object.
public class Envelope(string colour)
{
    public string Colour { get; set; } = colour;
}

public interface ICard
{
    List<string> Lines { get; }
    Envelope Envelope { get; }
    string Describe();
}

public class BirthdayCard(int age) : ICard
{
    public int Age { get; } = age;
    public List<string> Lines { get; } = [];
    public Envelope Envelope { get; } = new("white");

    public string Describe() => $"Birthday card ({Age}), {Envelope.Colour} envelope: {string.Join(" / ", Lines)}";
}

public class ThankYouCard(string to) : ICard
{
    public string To { get; } = to;
    public List<string> Lines { get; } = [];
    public Envelope Envelope { get; } = new("cream");

    public string Describe() => $"Thank-you card for {To}, {Envelope.Colour} envelope: {string.Join(" / ", Lines)}";
}

// Copies a card design so each customer can make it their own.
public class CardShop
{
    public ICard Copy(ICard card)
    {
        // Every new kind of card needs another case here,
        // and the shop has to know what is inside each one.
        switch (card)
        {
            case BirthdayCard birthday:
            {
                var copy = new BirthdayCard(birthday.Age);
                copy.Lines.AddRange(birthday.Lines);
                copy.Envelope.Colour = birthday.Envelope.Colour;
                return copy;
            }
            case ThankYouCard thanks:
            {
                var copy = new ThankYouCard(thanks.To);
                copy.Lines.AddRange(thanks.Lines);
                copy.Envelope.Colour = thanks.Envelope.Colour;
                return copy;
            }
            default:
                throw new NotSupportedException($"The shop cannot copy a {card.GetType().Name}.");
        }
    }
}
