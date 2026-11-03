var room = new ChatRoom();
var ana = room.Enter("Ana");
var ben = room.Enter("Ben");
var cleo = room.Enter("Cleo");
ana.Say("Hike on Sunday?");
cleo.Mute("Ana");
ana.Say("Meet at 9");
ben.Whisper("Cleo", "Ana is early again");
foreach (var line in cleo.Heard) Console.WriteLine($"Cleo heard: {line}");

// What a member talks to. Members only ever call these.
public interface IRoom
{
    void Said(Member member, string text);
    void Whispered(Member member, string to, string text);
    void Muted(Member member, string name);
    void Left(Member member);
}

// Keeps the members and every rule about who hears what.
public class ChatRoom : IRoom
{
    private readonly List<Member> members = [];
    private readonly Dictionary<Member, HashSet<string>> muted = [];

    public IReadOnlyList<Member> Members => members;

    public Member Enter(string name)
    {
        var member = new Member(name, this);
        foreach (var other in members) other.Hear($"{name} joined");
        members.Add(member);
        muted[member] = [];
        return member;
    }

    public void Said(Member member, string text)
    {
        if (!members.Contains(member)) return;
        foreach (var other in members)
            if (other != member && !muted[other].Contains(member.Name)) other.Hear($"{member.Name}: {text}");
    }

    public void Whispered(Member member, string to, string text)
    {
        if (!members.Contains(member)) return;
        var other = members.FirstOrDefault(m => m.Name == to && m != member);
        if (other is null) member.Hear($"{to} is not here");
        else if (!muted[other].Contains(member.Name)) other.Hear($"{member.Name} whispers: {text}");
    }

    public void Muted(Member member, string name) => muted[member].Add(name);

    public void Left(Member member)
    {
        if (!members.Remove(member)) return;
        foreach (var other in members) other.Hear($"{member.Name} left");
    }
}

public class Member(string name, IRoom room)
{
    private readonly List<string> heard = [];

    public string Name => name;
    public IReadOnlyList<string> Heard => heard;

    public void Say(string text) => room.Said(this, text);
    public void Whisper(string to, string text) => room.Whispered(this, to, text);
    public void Mute(string other) => room.Muted(this, other);
    public void Leave() => room.Left(this);

    // Used by the room.
    public void Hear(string line) => heard.Add(line);
}
