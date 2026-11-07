using System.Collections;

foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var calls = new RecentCalls();
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

// The phone's recent calls. A new call is added at the end of History, so the newest call is the last one.
public class RecentCalls
{
    public readonly List<Call> History = [];

    public void Add(Call call) => History.Add(call);
}

// The list on the phone's screen, the newest call first. It has to know that History is oldest first.
public static class CallScreen
{
    public static List<string> Lines(RecentCalls calls)
    {
        var lines = new List<string>();
        for (var i = calls.History.Count - 1; i >= 0; i--)
        {
            var call = calls.History[i];
            lines.Add(call.Missed ? $"{call.Name} (missed)" : call.Name);
        }
        return lines;
    }
}

// The red number on the phone icon. It reaches into History too.
public static class MissedBadge
{
    public static int Count(RecentCalls calls)
    {
        var missed = 0;
        for (var i = 0; i < calls.History.Count; i++)
            if (calls.History[i].Missed) missed++;
        return missed;
    }
}
