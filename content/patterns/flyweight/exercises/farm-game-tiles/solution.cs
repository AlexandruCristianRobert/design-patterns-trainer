foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var field = new Field(new GroundLooks());
        Ground[][] rows =
        [
            [Ground.Grass, Ground.Grass, Ground.Soil, Ground.Water],
            [Ground.Soil, Ground.Soil, Ground.Water, Ground.Water],
        ];
        for (var y = 0; y < rows.Length; y++)
            for (var x = 0; x < rows[y].Length; x++)
                field.Lay(x, y, rows[y][x]);
        return [field.Row(0), field.Row(1), field.Draw(0), field.Draw(7)];
    }
}

public enum Ground { Grass, Soil, Water }

// How one kind of ground looks. It never changes, so every tile of that ground shares it.
public sealed class GroundLook(string name, char symbol, string colour)
{
    public string Name { get; } = name;
    public char Symbol { get; } = symbol;
    public string Colour { get; } = colour;

    public string Draw(int x, int y) => $"{Name} {Symbol} ({Colour}) at {x},{y}";
}

// Hands out one GroundLook per ground, and creates it only the first time that ground is asked for.
public class GroundLooks
{
    private readonly Dictionary<Ground, GroundLook> made = new();

    public GroundLook Get(Ground ground)
    {
        if (made.TryGetValue(ground, out var look)) return look;
        look = ground switch
        {
            Ground.Grass => new GroundLook("grass", ',', "green"),
            Ground.Soil => new GroundLook("soil", '#', "brown"),
            _ => new GroundLook("water", '~', "blue"),
        };
        made[ground] = look;
        return look;
    }
}

public class Field(GroundLooks looks)
{
    // Per tile only its position, and a reference to the shared look.
    private readonly List<(int X, int Y, GroundLook Look)> tiles = [];

    public void Lay(int x, int y, Ground ground) => tiles.Add((x, y, looks.Get(ground)));

    public GroundLook LookAt(int index) => tiles[index].Look;

    public string Row(int y) => string.Concat(tiles.Where(t => t.Y == y).OrderBy(t => t.X).Select(t => t.Look.Symbol));

    public string Draw(int index) => tiles[index].Look.Draw(tiles[index].X, tiles[index].Y);
}
