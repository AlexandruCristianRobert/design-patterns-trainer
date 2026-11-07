foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        List<Contact> contacts = [new("Ana Pop", "ana@example.com"), new("Radu Ionescu", "radu@example.com")];
        var exporter = new ContactExporter();
        exporter.Export(contacts, ExportFormat.Csv);
        exporter.Export(contacts, ExportFormat.Mail);
        exporter.Export(contacts, ExportFormat.Label);

        return [.. Screen.Lines];
    }
}

// Collects what the program prints, so Demo.Run() can return it. Leave as is.
public static class Screen
{
    public static List<string> Lines { get; } = [];
}

public record Contact(string Name, string Email);

public enum ExportFormat { Csv, Mail, Label }

public class ContactExporter
{
    public void Export(List<Contact> contacts, ExportFormat format)
    {
        Screen.Lines.Add($"export of {contacts.Count} contacts");

        foreach (var contact in contacts)
        {
            switch (format)
            {
                case ExportFormat.Csv:
                    Screen.Lines.Add($"{contact.Name},{contact.Email}");
                    break;
                case ExportFormat.Mail:
                    Screen.Lines.Add($"{contact.Name} <{contact.Email}>");
                    break;
                case ExportFormat.Label:
                    Screen.Lines.Add($"{contact.Name}: {contact.Email}");
                    break;
            }
        }
    }
}
