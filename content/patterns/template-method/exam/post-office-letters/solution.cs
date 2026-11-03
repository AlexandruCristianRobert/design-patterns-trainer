foreach (var letter in new Posting[] { new StandardLetter(), new RegisteredLetter(), new AbroadLetter() })
{
    foreach (var line in letter.Send("Leeds", 30))
        Console.WriteLine(line);
    Console.WriteLine();
}

// Every letter is sent in the same steps, in the same order. Send is not virtual, so no kind of letter can change it.
public abstract class Posting
{
    public List<string> Send(string to, int grams)
    {
        var lines = new List<string> { $"weigh: {grams} g", $"stamp: {Postage(grams)} cents" };
        var paperwork = Paperwork();
        if (paperwork != "")
            lines.Add(paperwork);
        lines.Add($"sort into the bag for {to}");
        lines.Add("hand over the receipt");
        return lines;
    }

    // Each kind of letter has its own price.
    protected abstract int Postage(int grams);

    // Paperwork a kind of letter may need. By default there is none.
    protected virtual string Paperwork() => "";
}

public class StandardLetter : Posting
{
    protected override int Postage(int grams) => grams <= 20 ? 85 : 160;
}

public class RegisteredLetter : Posting
{
    protected override int Postage(int grams) => grams <= 20 ? 385 : 460;
    protected override string Paperwork() => "stick on a tracking label";
}

public class AbroadLetter : Posting
{
    protected override int Postage(int grams) => grams <= 20 ? 180 : 350;
    protected override string Paperwork() => "fill in a customs form";
}
