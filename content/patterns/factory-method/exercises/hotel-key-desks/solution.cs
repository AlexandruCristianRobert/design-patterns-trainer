foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        CheckInDesk front = new CardDesk();
        CheckInDesk night = new PinDesk();
        return
        [
            front.CheckIn("Ana", 12),
            front.CheckIn("Radu", 204),
            night.CheckIn("Zoe", 31),
        ];
    }
}

public interface IRoomKey
{
    string Describe();
}

public class KeyCard(int room) : IRoomKey
{
    public string Describe() => $"key card for room {room}";
}

public class PinCode(int room) : IRoomKey
{
    public string Describe() => $"PIN {room * 37 % 10000:D4} for room {room}";
}

public abstract class CheckInDesk
{
    // Each kind of desk decides which key it hands out.
    protected abstract IRoomKey MakeKey(int room);

    public string CheckIn(string guest, int room)
    {
        var key = MakeKey(room);
        return $"Welcome, {guest}: {key.Describe()}";
    }
}

public class CardDesk : CheckInDesk
{
    protected override IRoomKey MakeKey(int room) => new KeyCard(room);
}

public class PinDesk : CheckInDesk
{
    protected override IRoomKey MakeKey(int room) => new PinCode(room);
}
