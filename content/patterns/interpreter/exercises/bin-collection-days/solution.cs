// Paper goes out on Tuesdays and Fridays, but not on a public holiday.
BinRule paper = new Unless(new AnyOf(new OnWeekday("Tue"), new OnWeekday("Fri")), new PublicHoliday());

foreach (var day in new[] { new CollectionDay("Tue", false), new CollectionDay("Fri", true), new CollectionDay("Wed", false) })
    Console.WriteLine($"{day.Weekday}{(day.Holiday ? " (holiday)" : "")}: {(paper.Collects(day) ? "paper" : "no paper")}");

// One day, as the council's calendar sees it.
public class CollectionDay(string weekday, bool holiday)
{
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

public class PublicHoliday : BinRule
{
    public bool Collects(CollectionDay day) => day.Holiday;
}

public class AnyOf(BinRule first, BinRule second) : BinRule
{
    public bool Collects(CollectionDay day) => first.Collects(day) || second.Collects(day);
}

public class Unless(BinRule rule, BinRule exception) : BinRule
{
    public bool Collects(CollectionDay day) => rule.Collects(day) && !exception.Collects(day);
}
