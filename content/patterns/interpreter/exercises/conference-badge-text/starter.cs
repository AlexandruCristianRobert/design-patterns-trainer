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

// Writes the text on each kind of badge by hand. A new kind of badge means new code here.
public class BadgePrinter
{
    // "SPEAKER ANA SILVA / Northwind"
    public string Speaker(Attendee attendee) =>
        "SPEAKER " + attendee.Get("name").ToUpperInvariant() + " / " + attendee.Get("company");

    // "Ana Silva / Northwind"
    public string Guest(Attendee attendee) =>
        attendee.Get("name") + " / " + attendee.Get("company");
}
