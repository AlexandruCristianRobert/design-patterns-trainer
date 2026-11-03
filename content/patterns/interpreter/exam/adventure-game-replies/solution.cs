var door = new IfCarrying("lamp",
    new Then(new Say("By lamplight, "), new IfCarrying("key", new Say("you unlock the door."), new Say("you see a locked door."))),
    new Say("It is too dark to see."));

var ana = new Player("Ana", 12);
Console.WriteLine(door.Text(ana));
ana.Pick("lamp");
Console.WriteLine(door.Text(ana));
ana.Pick("key");
Console.WriteLine(door.Text(ana));

public class Player(string name, int gold)
{
    private readonly List<string> items = [];

    public string Name => name;
    public int Gold => gold;
    public void Pick(string item) => items.Add(item);
    public bool Carries(string item) => items.Contains(item);
}

// Every part of a reply writes its own text for a player.
public interface Reply
{
    string Text(Player player);
}

public class Say(string words) : Reply
{
    public string Text(Player player) => words;
}

public class PlayerName : Reply
{
    public string Text(Player player) => player.Name;
}

public class GoldCount : Reply
{
    public string Text(Player player) => player.Gold.ToString();
}

public class Then(Reply first, Reply second) : Reply
{
    public string Text(Player player) => first.Text(player) + second.Text(player);
}

public class IfCarrying(string item, Reply yes, Reply no) : Reply
{
    public string Text(Player player) => player.Carries(item) ? yes.Text(player) : no.Text(player);
}

public class IfGoldAtLeast(int gold, Reply yes, Reply no) : Reply
{
    public string Text(Player player) => player.Gold >= gold ? yes.Text(player) : no.Text(player);
}
