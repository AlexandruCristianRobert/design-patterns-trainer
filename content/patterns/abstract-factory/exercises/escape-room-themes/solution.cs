foreach (var line in new RoomSetup(new PirateTheme()).Prepare(2))
    Console.WriteLine($"pirate: {line}");

foreach (var line in new RoomSetup(new SpaceTheme()).Prepare(2))
    Console.WriteLine($"space: {line}");

public interface ILock
{
    string Describe();
}

public interface IClue
{
    string Describe();
}

public class ChestLock : ILock
{
    public string Describe() => "brass chest lock";
}

public class MapClue : IClue
{
    public string Describe() => "torn map";
}

public class KeypadLock : ILock
{
    public string Describe() => "keypad lock";
}

public class RadioClue : IClue
{
    public string Describe() => "crackling radio";
}

// Makes the lock and the clue for one theme, so they always match. Leave this interface as it is.
public interface IRoomTheme
{
    ILock MakeLock();
    IClue MakeClue();
}

public class PirateTheme : IRoomTheme
{
    public ILock MakeLock() => new ChestLock();
    public IClue MakeClue() => new MapClue();
}

public class SpaceTheme : IRoomTheme
{
    public ILock MakeLock() => new KeypadLock();
    public IClue MakeClue() => new RadioClue();
}

public class RoomSetup
{
    private readonly IRoomTheme theme;

    public RoomSetup(IRoomTheme theme) => this.theme = theme;

    public List<string> Prepare(int puzzles)
    {
        var lines = new List<string>();
        for (var i = 1; i <= puzzles; i++)
        {
            var clue = theme.MakeClue();
            var doorLock = theme.MakeLock();
            lines.Add($"Puzzle {i}: {clue.Describe()} opens {doorLock.Describe()}");
        }
        return lines;
    }
}
