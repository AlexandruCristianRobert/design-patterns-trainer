foreach (var line in new WoodFrame().Make(30, 40))
    Console.WriteLine(line);
Console.WriteLine();
foreach (var line in new MetalFrame().Make(50, 70))
    Console.WriteLine(line);

// Every frame the shop makes goes through the same steps, in the same order.
public abstract class FrameOrder
{
    // Makes the frame for a picture of width by height cm, and returns one line per step.
    public List<string> Make(int width, int height)
    {
        var lines = new List<string>();
        // TODO: add the line of each step, in this order:
        //       Measure, CutMoulding, FitGlazing, Assemble, and last Extra, but only when Extra is not empty.
        //       CutMoulding gets the length of moulding the frame needs: twice the width plus twice the height.
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
    // TODO: cut the length as "cut 240 cm of aluminium profile".
    protected override string CutMoulding(int length) => "";

    // TODO: metal frames get "fit acrylic".
    protected override string FitGlazing() => "";

    // TODO: metal frames have one extra step: "add corner protectors".
}
