var menu = new GameMenu(fullGame: false);
Console.WriteLine($"Levels loaded: {Level.Loaded}");
Console.WriteLine(menu.Start(2));
Console.WriteLine(menu.Start(2));
Console.WriteLine(menu.Start(5));
Console.WriteLine($"Levels loaded: {Level.Loaded}");

// What the game plays.
public interface ILevel
{
    string Play();
}

// The real level. Creating one loads its map, which is slow, so the static Loaded count goes up by 1.
public class Level : ILevel
{
    public static int Loaded { get; private set; }

    private readonly int number;

    public Level(int number)
    {
        this.number = number;
        Loaded++;
    }

    public string Play() => $"Level {number}: push {number + 2} crates onto the marks";
}

// The proxy: it holds the place of one level, and loads it the first time it may be played.
public class LevelSlot(int number, bool fullGame) : ILevel
{
    private Level? level;

    public string Play()
    {
        if (number > 3 && !fullGame)
            return $"Level {number} is in the full game";

        level ??= new Level(number);
        return level.Play();
    }
}

// The menu creates a slot for each of the six levels at start, which loads nothing.
public class GameMenu
{
    private readonly ILevel[] slots;

    public GameMenu(bool fullGame) =>
        slots = [.. Enumerable.Range(1, 6).Select(n => new LevelSlot(n, fullGame))];

    public string Start(int number) => slots[number - 1].Play();
}
