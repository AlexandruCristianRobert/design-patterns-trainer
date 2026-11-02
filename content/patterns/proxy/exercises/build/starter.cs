// Write LevelSlot and GameMenu as described in the scenario.
// The types below are given. Leave them as they are.

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
