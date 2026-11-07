foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var printer = new BadgePrinter();
        var ana = new Attendee("Ana Silva", "Northwind");
        var tom = new Attendee("Tom Berg", "Contoso");
        return [printer.Speaker(ana), printer.Speaker(tom), printer.Guest(ana), printer.Guest(tom)];
    }
}

// One person at the conference. Leave as is.
public class Attendee(string name, string company)
{
    // One field by its name: "name" or "company". Anything else is "".
    public string Get(string field) => field switch
    {
        "name" => name,
        "company" => company,
        _ => "",
    };
}

// Each kind of badge is a template: a tree of small words, made once and written out for any attendee.
public class BadgePrinter
{
    private readonly BadgeText speaker = new Join(new Words("SPEAKER "),
        new Join(new Upper(new Field("name")), new Join(new Words(" / "), new Field("company"))));

    private readonly BadgeText guest = new Join(new Field("name"), new Join(new Words(" / "), new Field("company")));

    public string Speaker(Attendee attendee) => speaker.Write(attendee);
    public string Guest(Attendee attendee) => guest.Write(attendee);
}

// Every word of the template language writes its own text for an attendee.
public interface BadgeText
{
    string Write(Attendee attendee);
}

// The same text for everyone.
public class Words(string text) : BadgeText
{
    public string Write(Attendee attendee) => text;
}

// One field of the attendee, read by its name.
public class Field(string name) : BadgeText
{
    public string Write(Attendee attendee) => attendee.Get(name);
}

// Its part, in capitals.
public class Upper(BadgeText part) : BadgeText
{
    public string Write(Attendee attendee) => part.Write(attendee).ToUpperInvariant();
}

// Its first part, then its second, with nothing in between.
public class Join(BadgeText first, BadgeText second) : BadgeText
{
    public string Write(Attendee attendee) => first.Write(attendee) + second.Write(attendee);
}
