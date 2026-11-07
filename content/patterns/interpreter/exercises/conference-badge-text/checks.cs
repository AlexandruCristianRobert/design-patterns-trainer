using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BadgeTextChecks
{
    // Two attendees, each with the words the failure messages use for them.
    static readonly (Attendee Attendee, string Said)[] People =
    [
        (new Attendee("Ana Silva", "Northwind"), "Ana Silva of Northwind"),
        (new Attendee("Tom Berg", "Contoso"), "Tom Berg of Contoso"),
    ];

    static readonly string[] Kinds = ["Words", "Field", "Upper", "Join"];

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected = ["SPEAKER ANA SILVA / Northwind", "SPEAKER TOM BERG / Contoso", "Ana Silva / Northwind", "Tom Berg / Contoso"];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("each-word-writes-its-text")]
    static void EachWordWritesItsText()
    {
        Try(Make("Words", "Hello"), "Words(\"Hello\")", ["Hello", "Hello"]);
        Try(Make("Field", "company"), "Field(\"company\")", ["Northwind", "Contoso"]);
        Try(Make("Upper", Make("Field", "name")), "Upper(Field(\"name\"))", ["ANA SILVA", "TOM BERG"]);
        Try(Make("Join", Make("Words", "Hi "), Make("Field", "name")), "Join(Words(\"Hi \"), Field(\"name\"))", ["Hi Ana Silva", "Hi Tom Berg"]);
    }

    [Check("nested-templates-write-every-badge")]
    static void NestedTemplatesWriteEveryBadge()
    {
        Try(Make("Upper", Make("Join", Make("Field", "name"), Make("Join", Make("Words", " of "), Make("Field", "company")))),
            "Upper(Join(Field(\"name\"), Join(Words(\" of \"), Field(\"company\"))))", ["ANA SILVA OF NORTHWIND", "TOM BERG OF CONTOSO"]);
        Try(Make("Join", Make("Upper", Make("Field", "company")), Make("Join", Make("Words", ": "), Make("Field", "name"))),
            "Join(Upper(Field(\"company\")), Join(Words(\": \"), Field(\"name\")))", ["NORTHWIND: Ana Silva", "CONTOSO: Tom Berg"]);
        Try(Make("Join", Make("Join", Make("Words", "["), Make("Upper", Make("Words", "vip"))), Make("Join", Make("Words", "] "), Make("Field", "name"))),
            "Join(Join(Words(\"[\"), Upper(Words(\"vip\"))), Join(Words(\"] \"), Field(\"name\")))", ["[VIP] Ana Silva", "[VIP] Tom Berg"]);
    }

    [Check("each-word-is-its-own-class")]
    static void EachWordIsItsOwnClass()
    {
        var text = Code.Type("BadgeText").Clr;
        foreach (var type in Kinds.Select(n => Code.Type(n).Clr))
        {
            Expect.That(text.IsAssignableFrom(type), "notAWord", new { type = type.Name });
            Expect.That(HasOwn(type, "Write"), "notItsOwn", new { type = type.Name });
        }

        var written = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(d => d.Identifier.ValueText == "BadgePrinter")
            .SelectMany(d => d.DescendantNodes())
            .FirstOrDefault(n => n is InterpolatedStringExpressionSyntax
                || n is BinaryExpressionSyntax { OperatorToken.ValueText: "+" }
                || n is InvocationExpressionSyntax call && call.Expression.ToString().Contains("ToUpper"));
        Expect.That(written is null, "printerStillWrites", new { code = written?.ToString().Split('\n')[0].Trim() });
    }

    // Writes the template for each attendee and compares the text.
    static void Try(object template, string written, string[] expected)
    {
        var write = Code.Type("BadgeText").Clr.GetMethod("Write", [typeof(Attendee)]);
        if (write is null) Expect.Fail("noWrite");
        for (var i = 0; i < People.Length; i++)
        {
            var actual = (string)write.Invoke(template, [People[i].Attendee])!;
            Expect.That(actual == expected[i], "wrongText", new { template = written, attendee = People[i].Said, expected = expected[i], actual });
        }
    }

    // A new word of the named type, made with a public constructor that takes these arguments.
    static object Make(string type, params object[] args)
    {
        var ctor = Code.Type(type).Clr.GetConstructors().FirstOrDefault(c =>
        {
            var ps = c.GetParameters();
            return ps.Length == args.Length && ps.Select((p, i) => p.ParameterType.IsAssignableFrom(args[i].GetType())).All(ok => ok);
        });
        if (ctor is null) Expect.Fail("noConstructor", new { type, count = args.Length });
        return ctor.Invoke(args);
    }

    // The type writes the method itself (an override, an interface method or an explicit one), not only inherits it.
    static bool HasOwn(Type type, string method) =>
        type.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly)
            .Any(m => !m.IsAbstract && (m.Name == method || m.Name.EndsWith("." + method)));
}
