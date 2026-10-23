foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var front = new CheckInDesk("card");
        var night = new CheckInDesk("pin");
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

// The desk is told which kind of key to hand out, and picks it with a switch.
// A new kind of key means editing this class again.
public class CheckInDesk(string keyKind)
{
    public string CheckIn(string guest, int room)
    {
        IRoomKey key = keyKind switch
        {
            "card" => new KeyCard(room),
            "pin" => new PinCode(room),
            _ => throw new ArgumentException($"unknown key kind: {keyKind}"),
        };
        return $"Welcome, {guest}: {key.Describe()}";
    }
}
