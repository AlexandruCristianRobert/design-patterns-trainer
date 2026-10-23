ICaption plain = new PlainCaption();
Console.WriteLine(plain.Render("we have to leave now"));

ICaption tagged = new SpeakerTag(plain, "Ana");
ICaption shouted = new Uppercase(tagged);
Console.WriteLine(shouted.Render("we have to leave now"));

// The same two decorators, stacked in the other order.
ICaption reversed = new SpeakerTag(new Uppercase(plain), "Ana");
Console.WriteLine(reversed.Render("we have to leave now"));

public interface ICaption
{
    string Render(string line);
}

public class PlainCaption : ICaption
{
    public string Render(string line) => line;
}

// A decorator is a caption itself, and it holds the caption it wraps.
public abstract class CaptionDecorator(ICaption inner) : ICaption
{
    protected ICaption Inner { get; } = inner;

    public virtual string Render(string line) => Inner.Render(line);
}

public class SpeakerTag(ICaption inner, string speaker) : CaptionDecorator(inner)
{
    public override string Render(string line) => $"{speaker}: {Inner.Render(line)}";
}

public class Uppercase(ICaption inner) : CaptionDecorator(inner)
{
    public override string Render(string line) => Inner.Render(line).ToUpperInvariant();
}
