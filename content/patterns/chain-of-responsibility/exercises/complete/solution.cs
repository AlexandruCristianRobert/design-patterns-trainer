var first = new Magnet();
first.SetNext(new Blower()).SetNext(new GlassEye());
var belt = new SortingLine(first);
Console.WriteLine(belt.Feed(new Item("steel can", "metal", 60)));
Console.WriteLine(belt.Feed(new Item("paper napkin", "paper", 3)));
Console.WriteLine(belt.Feed(new Item("jam jar", "glass", 200)));
Console.WriteLine(belt.Feed(new Item("bottle cap", "metal", 4)));
Console.WriteLine(belt.Feed(new Item("plastic tub", "plastic", 45)));

// One piece of rubbish on the belt. Leave as is.
public record Item(string Name, string Material, int Grams);

// Every machine on the sorting line. Each one holds the machine after it on the belt.
public abstract class Sorter
{
    private Sorter? next;

    // Puts a machine after this one and returns it, so the calls can follow each other: a.SetNext(b).SetNext(c).
    public Sorter SetNext(Sorter next)
    {
        this.next = next;
        return next;
    }

    public abstract string Sort(Item item);

    // Sends the item on down the belt. After the last machine, it falls into general waste.
    protected string Pass(Item item) =>
        next is null ? $"{item.Name} goes to general waste" : next.Sort(item);
}

// Pulls metal off the belt. It is finished: use it as the model for the other two. Leave as is.
public class Magnet : Sorter
{
    public override string Sort(Item item) =>
        item.Material == "metal" ? $"{item.Name} goes to the metal bin" : Pass(item);
}

// Blows light items off the belt.
public class Blower : Sorter
{
    public override string Sort(Item item) =>
        item.Grams < 30 ? $"{item.Name} goes to the light bin" : Pass(item);
}

// Sees glass and pushes it off the belt.
public class GlassEye : Sorter
{
    public override string Sort(Item item) =>
        item.Material == "glass" ? $"{item.Name} goes to the glass bin" : Pass(item);
}

// The start of the belt. It knows only the first machine. Leave as is.
public class SortingLine(Sorter first)
{
    public string Feed(Item item) => first.Sort(item);
}
