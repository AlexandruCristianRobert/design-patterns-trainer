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

// Every card can copy itself, so the shop never needs to know which kind it holds.
public interface ICard
{
    List<string> Lines { get; }
    Envelope Envelope { get; }
    string Describe();
    ICard Clone();
}

public class BirthdayCard(int age) : ICard
{
    public int Age { get; } = age;
    public List<string> Lines { get; } = [];
    public Envelope Envelope { get; } = new("white");

    public string Describe() => $"Birthday card ({Age}), {Envelope.Colour} envelope: {string.Join(" / ", Lines)}";

    // Written by hand: a new card with the same age, its own lines and its own envelope.
    public ICard Clone()
    {
        var copy = new BirthdayCard(Age);
        copy.Lines.AddRange(Lines);
        copy.Envelope.Colour = Envelope.Colour;
        return copy;
    }
}

public class ThankYouCard(string to) : ICard
{
    public string To { get; } = to;
    public List<string> Lines { get; private set; } = [];
    public Envelope Envelope { get; private set; } = new("cream");

    public string Describe() => $"Thank-you card for {To}, {Envelope.Colour} envelope: {string.Join(" / ", Lines)}";

    // MemberwiseClone copies the fields as they are, so the list and the envelope are replaced with copies.
    public ICard Clone()
    {
        var copy = (ThankYouCard)MemberwiseClone();
        copy.Lines = [.. Lines];
        copy.Envelope = new Envelope(Envelope.Colour);
        return copy;
    }
}

// Copies a card design so each customer can make it their own. Any kind of card works.
public class CardShop
{
    public ICard Copy(ICard card) => card.Clone();
}
