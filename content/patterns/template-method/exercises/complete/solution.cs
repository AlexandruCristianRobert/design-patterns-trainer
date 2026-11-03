foreach (var line in new WoodFrame().Make(30, 40))
    Console.WriteLine(line);
Console.WriteLine();
foreach (var line in new MetalFrame().Make(50, 70))
    Console.WriteLine(line);

// Every frame the shop makes goes through the same steps, in the same order.
public abstract class FrameOrder
{
    // Makes the frame for a picture of width by height cm, and returns one line per step.
    // It is not virtual, so no kind of frame can change the order.
    public List<string> Make(int width, int height)
    {
        var lines = new List<string>
        {
            Measure(width, height),
            CutMoulding(2 * width + 2 * height),
            FitGlazing(),
            Assemble(),
        };
        var extra = Extra();
        if (extra != "")
            lines.Add(extra);
        return lines;
    }

    // The same for every frame. Leave as is.
    private string Measure(int width, int height) => $"measure {width} x {height} cm";
    private string Assemble() => "assemble and fit the hanging wire";

    // Every kind of frame fills these in. Leave the declarations as they are.
    protected abstract string CutMoulding(int length);
    protected abstract string FitGlazing();

    // An extra step a kind of frame may add. By default there is none, and an empty line is left out. Leave as is.
    protected virtual string Extra() => "";
}

// A wooden frame. It is finished: use it as the model. Leave as is.
public class WoodFrame : FrameOrder
{
    protected override string CutMoulding(int length) => $"cut {length} cm of oak moulding";
    protected override string FitGlazing() => "fit glass";
}

// A metal frame.
public class MetalFrame : FrameOrder
{
    protected override string CutMoulding(int length) => $"cut {length} cm of aluminium profile";
    protected override string FitGlazing() => "fit acrylic";
    protected override string Extra() => "add corner protectors";
}
