var british = new StatementPrinter(new BritishRegion());
Console.WriteLine(british.Line(31, 1, 2026, "Rent", 125000));

var german = new StatementPrinter(new GermanRegion());
Console.WriteLine(german.Line(3, 4, 2026, "Bakery", 705));

public interface IDateStyle
{
    string Format(int day, int month, int year);
}

public interface IMoneyStyle
{
    string Format(int cents);
}

public class BritishDates : IDateStyle
{
    public string Format(int day, int month, int year) => $"{day:D2}/{month:D2}/{year}";
}

public class GermanDates : IDateStyle
{
    public string Format(int day, int month, int year) => $"{day:D2}.{month:D2}.{year}";
}

public class Pounds : IMoneyStyle
{
    public string Format(int cents) => $"£{cents / 100}.{cents % 100:D2}";
}

public class Euros : IMoneyStyle
{
    public string Format(int cents) => $"{cents / 100},{cents % 100:D2} €";
}

// Hands out the date style and the money style of one country, so a statement never mixes two countries.
public interface Region
{
    IDateStyle NewDateStyle();
    IMoneyStyle NewMoneyStyle();
}

public class BritishRegion : Region
{
    public IDateStyle NewDateStyle() => new BritishDates();
    public IMoneyStyle NewMoneyStyle() => new Pounds();
}

public class GermanRegion : Region
{
    public IDateStyle NewDateStyle() => new GermanDates();
    public IMoneyStyle NewMoneyStyle() => new Euros();
}

public class StatementPrinter(Region region)
{
    public string Line(int day, int month, int year, string text, int cents)
    {
        var dates = region.NewDateStyle();
        var money = region.NewMoneyStyle();
        return $"{dates.Format(day, month, year)} | {text} | {money.Format(cents)}";
    }
}
