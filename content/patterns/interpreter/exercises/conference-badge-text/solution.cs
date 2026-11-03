foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var printer = new BadgePrinter();
        var ana = new Attendee("Ana Silva", "Northwind", "Lisbon");
        var tom = new Attendee("Tom Berg", "", "Oslo");
        return [printer.Speaker(ana), printer.Speaker(tom), printer.Guest(ana), printer.Guest(tom), printer.Staff(tom)];
    }
}

// One person at the conference. Leave as is.
public class Attendee(string name, string company, string city)
{
    // One field by its name: "name", "company" or "city". An unknown field, or one left empty, is "".
    public string Get(string field) => field switch
    {
        "name" => name,
        "company" => company,
        "city" => city,
        _ => "",
    };
}

// Each kind of badge is a template: a tree of small words, made once and written out for any attendee.
public class BadgePrinter
{
    private readonly BadgeText speaker = new Join(new Words("SPEAKER "),
        new Join(new Upper(new Field("name")), new Join(new Words(" / "), new OrElse(new Field("company"), new Words("Independent")))));

    private readonly BadgeText guest = new Join(new Field("name"),
        new Join(new Words(" / "), new OrElse(new Field("company"), new Field("city"))));

    private readonly BadgeText staff = new Join(new Words("STAFF "),
        new Upper(new Join(new Field("name"), new Join(new Words(" from "), new Field("city")))));

    public string Speaker(Attendee attendee) => speaker.Write(attendee);
    public string Guest(Attendee attendee) => guest.Write(attendee);
    public string Staff(Attendee attendee) => staff.Write(attendee);
}

// Every word of the template language writes its own text for an attendee.
public abstract class BadgeText
{
    public abstract string Write(Attendee attendee);
}

// The same words for everyone.
public class Words(string text) : BadgeText
{
    public override string Write(Attendee attendee) => text;
}

// One field of the attendee, read by its name.
public class Field(string name) : BadgeText
{
    public override string Write(Attendee attendee) => attendee.Get(name);
}

// Its part, in capitals.
public class Upper(BadgeText part) : BadgeText
{
    public override string Write(Attendee attendee) => part.Write(attendee).ToUpperInvariant();
}

// Its first part, then its second, with nothing in between.
public class Join(BadgeText first, BadgeText second) : BadgeText
{
    public override string Write(Attendee attendee) => first.Write(attendee) + second.Write(attendee);
}

// Its first part, or the fallback when the first part is empty.
public class OrElse(BadgeText first, BadgeText fallback) : BadgeText
{
    public override string Write(Attendee attendee)
    {
        var text = first.Write(attendee);
        return text != "" ? text : fallback.Write(attendee);
    }
}
