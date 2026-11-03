using System.Reflection;
using DesignPatterns.Checks;

static class TicketChecks
{
    // A printer the program has never seen. It records the tickets it was asked to print.
    sealed class TestPrinter : ITicketPrinter
    {
        public List<Ticket> Printed { get; } = [];
        public void Print(Ticket ticket) => Printed.Add(ticket);
    }

    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every instance field of the type, including those declared in its base classes.
    static List<FieldInfo> Fields(Type type)
    {
        var fields = new List<FieldInfo>();
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            fields.AddRange(t.GetFields(Declared));
        return fields;
    }

    // A LabelPrinter for the device, made through its public constructor that takes just a LabelDevice.
    static ITicketPrinter LabelPrinterFor(LabelDevice device)
    {
        var type = Code.Type("LabelPrinter").Clr;
        if (!typeof(ITicketPrinter).IsAssignableFrom(type)) Expect.Fail("notAPrinter");
        var constructor = type.GetConstructor([typeof(LabelDevice)]);
        if (constructor is null) Expect.Fail("noDeviceConstructor");
        return (ITicketPrinter)constructor.Invoke([device]);
    }

    // True for the label device, and for any printer class (as opposed to the ITicketPrinter interface).
    static bool NamesAParticularPrinter(Type type) =>
        type == typeof(LabelDevice) || (type.IsClass && typeof(ITicketPrinter).IsAssignableFrom(type));

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "Dune, seat C4, 12.50",
            "[UP | A1 9.05]",
            "[HEAT | F12 11.00]",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("label-printer-prints-labels")]
    static void LabelPrinterPrintsLabels()
    {
        var paper = new List<string>();
        var printer = LabelPrinterFor(new LabelDevice(paper));
        printer.Print(new Ticket("Arrival", "H3", 700));
        printer.Print(new Ticket("Big Fish", "B10", 1005));
        var printed = string.Join(" / ", paper);

        Expect.That(printed == "[ARRIVAL | H3 7.00] / [BIG FISH | B10 10.05]", "wrongLabels", new { expected = "[ARRIVAL | H3 7.00] / [BIG FISH | B10 10.05]", actual = printed });
    }

    [Check("box-office-uses-any-printer")]
    static void BoxOfficeUsesAnyPrinter()
    {
        var printer = new TestPrinter();
        var office = new BoxOffice(printer);
        var first = new Ticket("Coco", "D7", 950);
        var second = new Ticket("Heat", "E2", 800);
        office.Sell(first);
        office.Sell(second);

        var printed = printer.Printed.Count == 0 ? "nothing" : string.Join(" / ", printer.Printed.Select(t => $"{t.Film} {t.Seat} {t.Cents}"));
        Expect.That(printer.Printed.SequenceEqual([first, second]), "wrongTickets", new { actual = printed });
    }

    [Check("box-office-knows-only-printers")]
    static void BoxOfficeKnowsOnlyPrinters()
    {
        var office = typeof(BoxOffice);
        var parameter = office.GetConstructors(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
            .SelectMany(c => c.GetParameters()).FirstOrDefault(p => NamesAParticularPrinter(p.ParameterType));
        Expect.That(parameter is null, "constructorNamesPrinter", new { type = parameter?.ParameterType.Name });

        var field = Fields(office).FirstOrDefault(f => NamesAParticularPrinter(f.FieldType));
        Expect.That(field is null, "fieldNamesPrinter", new { type = field?.FieldType.Name });

        Expect.That(!typeof(ITicketPrinter).IsAssignableFrom(typeof(LabelDevice)), "deviceChanged");

        var type = Code.Type("LabelPrinter").Clr;
        Expect.That(typeof(ITicketPrinter).IsAssignableFrom(type), "notAPrinter");
        Expect.That(Fields(type).Any(f => f.FieldType == typeof(LabelDevice)), "noDeviceKept");
    }
}
