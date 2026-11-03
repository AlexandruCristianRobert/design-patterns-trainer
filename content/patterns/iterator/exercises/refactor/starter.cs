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

// The phone keeps only the last few calls, in a ring of slots. A new call goes into the slot at Next,
// and when every slot is full, it overwrites the oldest call. Slots that were never used are null.
public class RecentCalls(int size)
{
    public readonly Call?[] Slots = new Call?[size];
    public int Next;

    public void Add(Call call)
    {
        Slots[Next] = call;
        Next = (Next + 1) % Slots.Length;
    }
}

// The list on the phone's screen, the newest call first. It has to know how the ring works.
public static class CallScreen
{
    public static List<string> Lines(RecentCalls calls)
    {
        var lines = new List<string>();
        for (var back = 1; back <= calls.Slots.Length; back++)
        {
            var call = calls.Slots[(calls.Next - back + calls.Slots.Length) % calls.Slots.Length];
            if (call is null) continue;
            lines.Add(call.Missed ? $"{call.Name} (missed)" : call.Name);
        }
        return lines;
    }
}

// The red number on the phone icon. It repeats the same ring arithmetic.
public static class MissedBadge
{
    public static int Count(RecentCalls calls)
    {
        var missed = 0;
        for (var back = 1; back <= calls.Slots.Length; back++)
        {
            var call = calls.Slots[(calls.Next - back + calls.Slots.Length) % calls.Slots.Length];
            if (call is not null && call.Missed) missed++;
        }
        return missed;
    }
}
