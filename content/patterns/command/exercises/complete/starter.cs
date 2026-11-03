var grid = new PixelGrid(4, 3);
var history = new History();

void Show(string what) => Console.WriteLine($"{what}: {grid}");

history.Run(new PaintPixel(grid, 0, 0, "red"));
Show("paint (0, 0) red");
history.Run(new FillRow(grid, 1, "blue"));
Show("fill row 1 blue");
history.Run(new SwapColours(grid, "red", "blue"));
Show("swap red and blue");
history.Undo();
Show("undo");
history.Undo();
Show("undo");

// A small picture of coloured pixels. Every pixel starts white. Leave as is.
public class PixelGrid(int width, int height)
{
    private readonly string[,] pixels = New(width, height);

    public int Width => width;
    public int Height => height;

    public string Get(int x, int y) => pixels[x, y];
    public void Set(int x, int y, string colour) => pixels[x, y] = colour;

    // The rows from top to bottom, such as "red white / blue blue".
    public override string ToString() =>
        string.Join(" / ", Enumerable.Range(0, height).Select(y =>
            string.Join(" ", Enumerable.Range(0, width).Select(x => pixels[x, y]))));

    private static string[,] New(int width, int height)
    {
        var pixels = new string[width, height];
        for (var x = 0; x < width; x++)
            for (var y = 0; y < height; y++)
                pixels[x, y] = "white";
        return pixels;
    }
}

// Every step the editor can do and undo. Leave as is.
public interface IPaintStep
{
    void Do();
    void Undo();
}

// Paints one pixel. It is finished: use it as the model for the other two. Leave as is.
public class PaintPixel(PixelGrid grid, int x, int y, string colour) : IPaintStep
{
    private string before = "";

    public void Do()
    {
        before = grid.Get(x, y);
        grid.Set(x, y, colour);
    }

    public void Undo() => grid.Set(x, y, before);
}

// Paints a whole row one colour.
public class FillRow(PixelGrid grid, int y, string colour) : IPaintStep
{
    public void Do()
    {
        // TODO: paint every pixel of row y in the colour.
        // TODO: first keep what each pixel was, because Undo needs it.
    }

    public void Undo()
    {
        // TODO: put back every pixel of row y exactly as it was before Do.
    }
}

// Turns every pixel of one colour into the other, and the other way round.
public class SwapColours(PixelGrid grid, string first, string second) : IPaintStep
{
    public void Do()
    {
        // TODO: every pixel of the first colour becomes the second, and every pixel of the second becomes the first.
        //       Pixels of any other colour stay as they are.
    }

    public void Undo()
    {
        // TODO: put every pixel back exactly as it was before Do.
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
