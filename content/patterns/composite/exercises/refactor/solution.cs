foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var title = new Box(0, 0, 8, 2);
        var dot = new Box(10, 0, 1, 1);
        var bar = new Box(12, 0, 3, 2);
        var stamp = new Box(30, 10, 4, 4);

        var icon = new Group();
        icon.Add(dot);
        icon.Add(bar);
        var logo = new Group();
        logo.Add(title);
        logo.Add(icon);

        var canvas = new Canvas();
        canvas.Add(logo);
        canvas.Add(stamp);

        var lines = new List<string> { $"area {canvas.TotalArea()}" };
        canvas.MoveAll(5, 1);
        lines.Add($"title at {title.X},{title.Y}, dot at {dot.X},{dot.Y}, bar at {bar.X},{bar.Y}, stamp at {stamp.X},{stamp.Y}");
        return lines;
    }
}

public interface IShape
{
    int Area();
    void Move(int dx, int dy);
}

// A rectangle on the canvas. Leave it as it is.
public class Box(int x, int y, int width, int height) : IShape
{
    public int X { get; private set; } = x;
    public int Y { get; private set; } = y;

    public int Area() => width * height;

    public void Move(int dx, int dy)
    {
        X += dx;
        Y += dy;
    }
}

// The composite: a group is a shape too, and passes each request on to the shapes it holds.
public class Group : IShape
{
    private readonly List<IShape> shapes = [];

    public void Add(IShape shape) => shapes.Add(shape);

    public int Area() => shapes.Sum(s => s.Area());

    public void Move(int dx, int dy)
    {
        foreach (var shape in shapes)
            shape.Move(dx, dy);
    }
}

// The canvas only knows IShape, so it never asks whether a shape is a box or a group.
public class Canvas
{
    private readonly List<IShape> shapes = [];

    public void Add(IShape shape) => shapes.Add(shape);

    public int TotalArea() => shapes.Sum(s => s.Area());

    public void MoveAll(int dx, int dy)
    {
        foreach (var shape in shapes)
            shape.Move(dx, dy);
    }
}
