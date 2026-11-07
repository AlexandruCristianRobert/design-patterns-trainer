var canvas = new Canvas(4);
var history = new History();

history.Run(new PaintPixel(canvas, 0, "red"));
Console.WriteLine($"paint pixel 0 red: {canvas}");
history.Run(new SwapPixels(canvas, 0, 3));
Console.WriteLine($"swap pixels 0 and 3: {canvas}");
history.Undo();
Console.WriteLine($"undo: {canvas}");
history.Undo();
Console.WriteLine($"undo: {canvas}");

// One row of pixels, numbered from 0. Every pixel starts white. Leave as is.
public class Canvas(int size)
{
    private readonly string[] pixels = Enumerable.Repeat("white", size).ToArray();

    public string Get(int pixel) => pixels[pixel];
    public void Set(int pixel, string colour) => pixels[pixel] = colour;

    // The colours in order, such as "red white blue".
    public override string ToString() => string.Join(" ", pixels);
}

// Every step the editor can do and undo. Leave as is.
public interface IPaintStep
{
    void Do();
    void Undo();
}

// Paints one pixel. It is finished: use it as the model. Leave as is.
public class PaintPixel(Canvas canvas, int pixel, string colour) : IPaintStep
{
    private string before = "";

    public void Do()
    {
        before = canvas.Get(pixel);
        canvas.Set(pixel, colour);
    }

    public void Undo() => canvas.Set(pixel, before);
}

// Gives each of two pixels the other's colour. Do is finished.
public class SwapPixels(Canvas canvas, int first, int second) : IPaintStep
{
    public void Do()
    {
        var colour = canvas.Get(first);
        canvas.Set(first, canvas.Get(second));
        canvas.Set(second, colour);
    }

    public void Undo()
    {
        // TODO: put both pixels back as they were before Do.
    }
}

// Runs steps and keeps them, so that they can be undone, the last one first.
public class History
{
    private readonly Stack<IPaintStep> done = new();

    public void Run(IPaintStep step)
    {
        // TODO: do the step, and keep it.
    }

    public void Undo()
    {
        // TODO: undo the last step that was kept, and forget it. With no step left, do nothing.
    }
}
