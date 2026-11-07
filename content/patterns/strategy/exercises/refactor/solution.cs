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
        new ContactExporter(new LabelFormat()).Export(contacts);

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
    string Line(Contact contact);
}

public class ContactExporter(IContactFormat format)
{
    public void Export(List<Contact> contacts)
    {
        // The part every format shares stays here.
        Screen.Lines.Add($"export of {contacts.Count} contacts");

        foreach (var contact in contacts)
            Screen.Lines.Add(format.Line(contact));
    }
}

public class CsvFormat : IContactFormat
{
    public string Line(Contact contact) => $"{contact.Name},{contact.Email}";
}

public class MailFormat : IContactFormat
{
    public string Line(Contact contact) => $"{contact.Name} <{contact.Email}>";
}

public class LabelFormat : IContactFormat
{
    public string Line(Contact contact) => $"{contact.Name}: {contact.Email}";
}
