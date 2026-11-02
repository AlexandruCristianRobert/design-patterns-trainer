foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Screen.Lines.Clear();

        Book("Rex", () => new GroomingBuilder("Rex").Bath().Haircut("summer cut").Bow().Build());
        Book("Mia", () => new GroomingBuilder("Mia").Nails().Build());
        Book("Bruno", () => new GroomingBuilder("Bruno").Teeth().Nails().Bath().Build());
        Book("Lola", () => new GroomingBuilder("Lola").Haircut("lion cut").Build());
        Book("Tom", () => new GroomingBuilder("Tom").Build());

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

// Only the builder creates a visit, so every visit has passed its checks.
public class GroomingVisit
{
    private readonly string pet;
    private readonly bool bath;
    private readonly bool nails;
    private readonly string? haircut;
    private readonly bool teeth;
    private readonly bool bow;

    internal GroomingVisit(string pet, bool bath, bool nails, string? haircut, bool teeth, bool bow)
    {
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

// Each step names one service, in any order. Build() checks the whole visit.
public class GroomingBuilder(string pet)
{
    private bool bath;
    private bool nails;
    private string? haircut;
    private bool teeth;
    private bool bow;

    public GroomingBuilder Bath() { bath = true; return this; }
    public GroomingBuilder Nails() { nails = true; return this; }
    public GroomingBuilder Haircut(string style) { haircut = style; return this; }
    public GroomingBuilder Teeth() { teeth = true; return this; }
    public GroomingBuilder Bow() { bow = true; return this; }

    public GroomingVisit Build()
    {
        if (!bath && !nails && haircut is null && !teeth && !bow)
            throw new InvalidOperationException("Nothing is booked.");
        if (haircut is not null && !bath)
            throw new InvalidOperationException("A haircut needs a bath.");
        return new GroomingVisit(pet, bath, nails, haircut, teeth, bow);
    }
}
