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

// The phone's recent calls. The list stays inside: walking it gives the calls, newest first.
public class RecentCalls : IEnumerable<Call>
{
    private readonly List<Call> history = [];

    public void Add(Call call) => history.Add(call);

    // The newest call is the last one in the list, so walk it from the end.
    public IEnumerator<Call> GetEnumerator()
    {
        for (var i = history.Count - 1; i >= 0; i--)
            yield return history[i];
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

// The list on the phone's screen, the newest call first. It knows nothing about the list.
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
