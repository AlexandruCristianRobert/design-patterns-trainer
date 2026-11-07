foreach (var line in new WoodFrame().Make())
    Console.WriteLine(line);
Console.WriteLine();
foreach (var line in new MetalFrame().Make())
    Console.WriteLine(line);

// Every frame the shop makes goes through the same steps, in the same order.
public abstract class FrameOrder
{
    // Makes one frame and returns one line per step.
    public List<string> Make()
    {
        var lines = new List<string>();
        // TODO: add the line of each step, in this order:
        //       "measure the picture", CutMoulding(), FitGlazing(), "assemble and fit the hanging wire",
        //       and last Extra(), but only when it is not empty.
        return lines;
    }

    // Every kind of frame fills these in. Leave the declarations as they are.
    protected abstract string CutMoulding();
    protected abstract string FitGlazing();

    // An extra step a kind of frame may add. By default there is none. Leave as is.
    protected virtual string Extra() => "";
}

// A wooden frame. It keeps the default Extra. Leave as is.
public class WoodFrame : FrameOrder
{
    protected override string CutMoulding() => "cut oak moulding";
    protected override string FitGlazing() => "fit glass";
}

// A metal frame.
public class MetalFrame : FrameOrder
{
    protected override string CutMoulding() => "cut aluminium profile";
    protected override string FitGlazing() => "fit acrylic";

    // TODO: metal frames have one extra step: "add corner protectors".
}
