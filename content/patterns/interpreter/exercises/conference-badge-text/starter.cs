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

// Writes the text on each kind of badge. Every kind of badge is written out by hand, and a new kind means new code here.
public class BadgePrinter
{
    // "SPEAKER ANA SILVA / Northwind", or "Independent" when the speaker has no company.
    public string Speaker(Attendee attendee)
    {
        var company = attendee.Get("company");
        return "SPEAKER " + attendee.Get("name").ToUpperInvariant() + " / " + (company != "" ? company : "Independent");
    }

    // "Ana Silva / Northwind", or the city when the guest has no company.
    public string Guest(Attendee attendee)
    {
        var company = attendee.Get("company");
        return attendee.Get("name") + " / " + (company != "" ? company : attendee.Get("city"));
    }

    // "STAFF TOM BERG FROM OSLO".
    public string Staff(Attendee attendee) =>
        "STAFF " + (attendee.Get("name") + " from " + attendee.Get("city")).ToUpperInvariant();
}
