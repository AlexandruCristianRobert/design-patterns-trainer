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

// Shapes the user grouped together. A group can also hold other groups.
public class Group
{
    private readonly List<object> items = [];

    public void Add(object item) => items.Add(item);

    public List<object> Items() => items;
}

public class Canvas
{
    private readonly List<object> items = [];

    public void Add(object item) => items.Add(item);

    public int TotalArea() => AreaOf(items);

    public void MoveAll(int dx, int dy) => MoveEach(items, dx, dy);

    // Every operation needs its own walk with the same checks, and a new kind of item means changing each one.
    private static int AreaOf(List<object> items)
    {
        var total = 0;
        foreach (var item in items)
        {
            if (item is Group group)
                total += AreaOf(group.Items());
            else if (item is IShape shape)
                total += shape.Area();
        }
        return total;
    }

    private static void MoveEach(List<object> items, int dx, int dy)
    {
        foreach (var item in items)
        {
            if (item is Group group)
                MoveEach(group.Items(), dx, dy);
            else if (item is IShape shape)
                shape.Move(dx, dy);
        }
    }
}
