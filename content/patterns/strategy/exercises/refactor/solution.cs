foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        List<Contact> contacts = [new("Ana Pop", "ana@example.com"), new("Radu Ionescu", "radu@example.com")];
        new ContactExporter(new CsvFormat()).Export(contacts);
        new ContactExporter(new MailFormat()).Export(contacts);
        new ContactExporter(new JsonFormat()).Export(contacts);

        return [.. Screen.Lines];
    }
}

// Collects what the program prints, so Demo.Run() can return it. Leave as is.
public static class Screen
{
    public static List<string> Lines { get; } = [];
}

public record Contact(string Name, string Email);

public interface IContactFormat
{
    // The line printed before the contacts, or null for none.
    string? Header { get; }
    string Line(Contact contact);
}

public class ContactExporter(IContactFormat format)
{
    public void Export(List<Contact> contacts)
    {
        // The part every format shares stays here.
        Screen.Lines.Add($"export of {contacts.Count} contacts");

        if (format.Header is { } header)
            Screen.Lines.Add(header);

        foreach (var contact in contacts)
            Screen.Lines.Add(format.Line(contact));
    }
}

public class CsvFormat : IContactFormat
{
    public string? Header => "name,email";
    public string Line(Contact contact) => $"{contact.Name},{contact.Email}";
}

public class MailFormat : IContactFormat
{
    public string? Header => null;
    public string Line(Contact contact) => $"{contact.Name} <{contact.Email}>";
}

public class JsonFormat : IContactFormat
{
    public string? Header => null;
    public string Line(Contact contact) => $"{{\"name\":\"{contact.Name}\",\"email\":\"{contact.Email}\"}}";
}
