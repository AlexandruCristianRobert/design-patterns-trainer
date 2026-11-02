foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        // Which true is the bath, and which one the bow? Every booking has to pass all six values in order.
        Book("Rex", () => new GroomingVisit("Rex", true, false, "summer cut", false, true));
        Book("Mia", () => new GroomingVisit("Mia", false, true, null, false, false));
        Book("Bruno", () => new GroomingVisit("Bruno", true, true, null, true, false));
        Book("Lola", () => new GroomingVisit("Lola", false, false, "lion cut", false, false));
        Book("Tom", () => new GroomingVisit("Tom", false, false, null, false, false));

        return [.. Screen.Lines];
    }

    static void Book(string pet, Func<GroomingVisit> make)
    {
        try
        {
            Screen.Lines.Add(make().Describe());
        }
        catch (InvalidOperationException problem)
        {
            Screen.Lines.Add($"{pet}: rejected ({problem.Message})");
        }
    }
}

// Collects what the program prints, so Demo.Run() can return it. Leave as is.
public static class Screen
{
    public static List<string> Lines { get; } = [];
}

public class GroomingVisit
{
    private readonly string pet;
    private readonly bool bath;
    private readonly bool nails;
    private readonly string? haircut;
    private readonly bool teeth;
    private readonly bool bow;

    public GroomingVisit(string pet, bool bath, bool nails, string? haircut, bool teeth, bool bow)
    {
        if (!bath && !nails && haircut is null && !teeth && !bow)
            throw new InvalidOperationException("Nothing is booked.");
        if (haircut is not null && !bath)
            throw new InvalidOperationException("A haircut needs a bath.");

        this.pet = pet;
        this.bath = bath;
        this.nails = nails;
        this.haircut = haircut;
        this.teeth = teeth;
        this.bow = bow;
    }

    public string Describe()
    {
        List<string> services = [];
        if (bath) services.Add("bath");
        if (nails) services.Add("nails");
        if (haircut is not null) services.Add(haircut);
        if (teeth) services.Add("teeth");
        if (bow) services.Add("bow");
        return $"{pet}: {string.Join(", ", services)}";
    }
}
