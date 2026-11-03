var calendar = new BinCalendar();
// Paper goes out on the Tuesday of every second week, but not on a public holiday.
calendar.Add("paper", new Unless(new AllOf(new OnWeekday("Tue"), new EveryNthWeek(2)), new PublicHoliday()));
// Glass goes out on the Friday of every fourth week.
calendar.Add("glass", new AllOf(new OnWeekday("Fri"), new EveryNthWeek(4)));

foreach (var day in new[] { new CollectionDay(2, "Tue", false), new CollectionDay(4, "Tue", true), new CollectionDay(8, "Fri", false) })
    Console.WriteLine($"week {day.Week}, {day.Weekday}{(day.Holiday ? " (holiday)" : "")}: {calendar.BinsOn(day)}");

// One day of the year, as the council's calendar sees it.
public class CollectionDay(int week, string weekday, bool holiday)
{
    public int Week => week;
    public string Weekday => weekday;
    public bool Holiday => holiday;
}

// Every word of the council's rule language says whether bins are collected on a day.
public interface BinRule
{
    bool Collects(CollectionDay day);
}

public class OnWeekday(string weekday) : BinRule
{
    public bool Collects(CollectionDay day) => day.Weekday == weekday;
}

public class EveryNthWeek(int n) : BinRule
{
    public bool Collects(CollectionDay day) => day.Week % n == 0;
}

public class PublicHoliday : BinRule
{
    public bool Collects(CollectionDay day) => day.Holiday;
}

public class AllOf(BinRule first, BinRule second) : BinRule
{
    public bool Collects(CollectionDay day) => first.Collects(day) && second.Collects(day);
}

public class AnyOf(BinRule first, BinRule second) : BinRule
{
    public bool Collects(CollectionDay day) => first.Collects(day) || second.Collects(day);
}

public class Unless(BinRule rule, BinRule exception) : BinRule
{
    public bool Collects(CollectionDay day) => rule.Collects(day) && !exception.Collects(day);
}

// Each bin with its rule, in the order they were added. It only ever asks a rule whether it collects.
public class BinCalendar
{
    private readonly List<(string Bin, BinRule Rule)> bins = [];

    public void Add(string bin, BinRule rule) => bins.Add((bin, rule));

    public string BinsOn(CollectionDay day)
    {
        var due = bins.Where(b => b.Rule.Collects(day)).Select(b => b.Bin).ToList();
        return due.Count == 0 ? "none" : string.Join(", ", due);
    }
}
