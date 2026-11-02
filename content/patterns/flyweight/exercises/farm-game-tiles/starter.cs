foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var field = new Field();
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

// One square of a farming game's field. A field can have 10,000 of them, but only three kinds of ground,
// and every tile keeps its own copy of how its ground looks.
public class Tile
{
    public Tile(int x, int y, Ground ground)
    {
        X = x;
        Y = y;
        (Name, Symbol, Colour) = ground switch
        {
            Ground.Grass => ("grass", ',', "green"),
            Ground.Soil => ("soil", '#', "brown"),
            _ => ("water", '~', "blue"),
        };
    }

    public int X { get; }
    public int Y { get; }
    public string Name { get; }
    public char Symbol { get; }
    public string Colour { get; }

    public string Draw() => $"{Name} {Symbol} ({Colour}) at {X},{Y}";
}

public class Field
{
    private readonly List<Tile> tiles = [];

    public void Lay(int x, int y, Ground ground) => tiles.Add(new Tile(x, y, ground));

    public string Row(int y) => string.Concat(tiles.Where(t => t.Y == y).OrderBy(t => t.X).Select(t => t.Symbol));

    public string Draw(int index) => tiles[index].Draw();
}
