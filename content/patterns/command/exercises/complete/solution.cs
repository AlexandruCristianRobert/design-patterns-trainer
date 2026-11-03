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
    private string[] before = [];

    public void Do()
    {
        before = new string[grid.Width];
        for (var x = 0; x < grid.Width; x++)
        {
            before[x] = grid.Get(x, y);
            grid.Set(x, y, colour);
        }
    }

    public void Undo()
    {
        for (var x = 0; x < grid.Width; x++)
            grid.Set(x, y, before[x]);
    }
}

// Turns every pixel of one colour into the other, and the other way round.
public class SwapColours(PixelGrid grid, string first, string second) : IPaintStep
{
    public void Do()
    {
        for (var x = 0; x < grid.Width; x++)
            for (var y = 0; y < grid.Height; y++)
            {
                var pixel = grid.Get(x, y);
                if (pixel == first) grid.Set(x, y, second);
                else if (pixel == second) grid.Set(x, y, first);
            }
    }

    // Swapping again puts every pixel back.
    public void Undo() => Do();
}

// Runs steps and keeps them, so that they can be undone, the last one first.
public class History
{
    private readonly Stack<IPaintStep> done = new();

    public void Run(IPaintStep step)
    {
        step.Do();
        done.Push(step);
    }

    public void Undo()
    {
        if (done.Count > 0)
            done.Pop().Undo();
    }
}
