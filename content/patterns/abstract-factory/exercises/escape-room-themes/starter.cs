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
    // TODO: a space room uses a KeypadLock and a RadioClue.
    public ILock MakeLock() => throw new NotImplementedException();
    public IClue MakeClue() => throw new NotImplementedException();
}

public class RoomSetup
{
    private readonly IRoomTheme theme;

    public RoomSetup(IRoomTheme theme) => this.theme = theme;

    public List<string> Prepare(int puzzles)
    {
        // TODO: for each puzzle, get a new lock and a new clue from the theme and describe them:
        // "Puzzle 1: torn map opens brass chest lock", "Puzzle 2: ...".
        return [];
    }
}
