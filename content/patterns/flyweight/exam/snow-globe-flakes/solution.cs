var shapes = new FlakeShapes();
var sky = new Sky(shapes);
sky.Drop(4, 20, "star");
sky.Drop(7, 4, "needle");
sky.Tick();
sky.Tick();

Console.WriteLine(sky.Draw(0));
Console.WriteLine(sky.Draw(1));
Console.WriteLine($"Shapes created: {shapes.Created}");

// What every snowflake of one shape has in common. It never changes, so all those flakes share it.
public sealed class FlakeShape(string name, char symbol, int speed)
{
    public string Name { get; } = name;
    public char Symbol { get; } = symbol;
    public int Speed { get; } = speed;
}

// Hands out one FlakeShape per name, and creates it only the first time that name is asked for.
public class FlakeShapes
{
    private readonly Dictionary<string, FlakeShape> made = new();

    public int Created => made.Count;

    public FlakeShape Get(string name)
    {
        if (made.TryGetValue(name, out var shape)) return shape;
        shape = name switch
        {
            "star" => new FlakeShape("star", '*', 2),
            "plate" => new FlakeShape("plate", 'o', 1),
            "needle" => new FlakeShape("needle", '|', 3),
            _ => throw new ArgumentException($"No flake shape called {name}."),
        };
        made[name] = shape;
        return shape;
    }
}

// One falling flake: where it is now, and a reference to its shared shape.
public struct Flake(int x, int height, FlakeShape shape)
{
    public int X { get; } = x;
    public int Height { get; set; } = height;
    public FlakeShape Shape { get; } = shape;
}

public class Sky(FlakeShapes shapes)
{
    private readonly List<Flake> flakes = [];

    public void Drop(int x, int height, string shape) => flakes.Add(new Flake(x, height, shapes.Get(shape)));

    public void Tick()
    {
        for (var i = 0; i < flakes.Count; i++)
        {
            var flake = flakes[i];
            flake.Height = Math.Max(0, flake.Height - flake.Shape.Speed);
            flakes[i] = flake;
        }
    }

    public FlakeShape ShapeOf(int index) => flakes[index].Shape;

    public string Draw(int index)
    {
        var flake = flakes[index];
        return $"{flake.Shape.Name} {flake.Shape.Symbol} at {flake.X},{flake.Height}";
    }
}
