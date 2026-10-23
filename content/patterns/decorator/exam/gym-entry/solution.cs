List<string> managerLog = [];
List<string> securityLog = [];
var members = new MemberGate(["ana", "radu"]);

// The night door: a visit counter, a log for security and a log for the manager.
var counter = new VisitCounter(members);
IEntryGate nightDoor = new EntryLog(new EntryLog(counter, securityLog), managerLog);

foreach (var name in new[] { "ana", "zoe", "radu" })
    Console.WriteLine($"{name}: {(nightDoor.Swipe(name) ? "open" : "closed")}");
Console.WriteLine($"visits: {counter.Visits}");
Console.WriteLine($"manager log: {string.Join(", ", managerLog)}");
Console.WriteLine($"security log: {string.Join(", ", securityLog)}");

public interface IEntryGate
{
    bool Swipe(string member);
}

public class MemberGate(List<string> members) : IEntryGate
{
    public bool Swipe(string member) => members.Contains(member);
}

public class EntryLog(IEntryGate gate, List<string> lines) : IEntryGate
{
    public bool Swipe(string member)
    {
        var allowed = gate.Swipe(member);
        lines.Add($"{member}: {(allowed ? "in" : "refused")}");
        return allowed;
    }
}

public class VisitCounter(IEntryGate gate) : IEntryGate
{
    public int Visits { get; private set; }

    public bool Swipe(string member)
    {
        var allowed = gate.Swipe(member);
        if (allowed) Visits++;
        return allowed;
    }
}
