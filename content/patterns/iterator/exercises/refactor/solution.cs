using System.Collections;

foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var calls = new RecentCalls(4);
        var lines = new List<string>();
        calls.Add(new Call("Mum", false));
        calls.Add(new Call("Dentist", true));
        lines.Add($"screen: {string.Join(", ", CallScreen.Lines(calls))}");
        lines.Add($"missed: {MissedBadge.Count(calls)}");
        calls.Add(new Call("Sam", true));
        calls.Add(new Call("Work", false));
        calls.Add(new Call("Gym", true));
        lines.Add($"screen: {string.Join(", ", CallScreen.Lines(calls))}");
        lines.Add($"missed: {MissedBadge.Count(calls)}");
        return lines;
    }
}

// One call in the phone's list: who it was, and whether it was missed. Leave as is.
public record Call(string Name, bool Missed);

// The phone keeps only the last few calls, in a ring of slots. A new call goes into the next slot,
// and when every slot is full, it overwrites the oldest call. The ring stays inside: walking it gives the calls, newest first.
public class RecentCalls(int size) : IEnumerable<Call>
{
    private readonly Call?[] slots = new Call?[size];
    private int next;

    public void Add(Call call)
    {
        slots[next] = call;
        next = (next + 1) % slots.Length;
    }

    // The newest call first. Slots that were never used are stepped over.
    public IEnumerator<Call> GetEnumerator()
    {
        for (var back = 1; back <= slots.Length; back++)
            if (slots[(next - back + slots.Length) % slots.Length] is { } call)
                yield return call;
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

// The list on the phone's screen, the newest call first. It knows nothing about the ring.
public static class CallScreen
{
    public static List<string> Lines(RecentCalls calls) =>
        calls.Select(call => call.Missed ? $"{call.Name} (missed)" : call.Name).ToList();
}

// The red number on the phone icon.
public static class MissedBadge
{
    public static int Count(RecentCalls calls)
    {
        var missed = 0;
        foreach (var call in calls)
            if (call.Missed) missed++;
        return missed;
    }
}
