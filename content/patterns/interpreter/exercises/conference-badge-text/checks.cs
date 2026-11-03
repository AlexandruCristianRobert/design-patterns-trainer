using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BadgeTextChecks
{
    // Three attendees, each with the words the failure messages use for them.
    static readonly (Attendee Attendee, string Said)[] People =
    [
        (new Attendee("Ana Silva", "Northwind", "Lisbon"), "Ana Silva of Northwind, from Lisbon"),
        (new Attendee("Tom Berg", "", "Oslo"), "Tom Berg, with no company, from Oslo"),
        (new Attendee("Lea Roy", "", ""), "Lea Roy, with no company and no city"),
    ];

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "SPEAKER ANA SILVA / Northwind",
            "SPEAKER TOM BERG / Independent",
            "Ana Silva / Northwind",
            "Tom Berg / Oslo",
            "STAFF TOM BERG FROM OSLO",
        ];
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
        Try(Make("Words", "Hello"), "Words(\"Hello\")", ["Hello", "Hello", "Hello"]);
        Try(Make("Field", "city"), "Field(\"city\")", ["Lisbon", "Oslo", ""]);
        Try(Make("Field", "shoe size"), "Field(\"shoe size\")", ["", "", ""]);
        Try(Make("Upper", Make("Field", "name")), "Upper(Field(\"name\"))", ["ANA SILVA", "TOM BERG", "LEA ROY"]);
        Try(Make("Join", Make("Words", "Hi "), Make("Field", "name")), "Join(Words(\"Hi \"), Field(\"name\"))",
            ["Hi Ana Silva", "Hi Tom Berg", "Hi Lea Roy"]);
        Try(Make("OrElse", Make("Field", "company"), Make("Words", "none")), "OrElse(Field(\"company\"), Words(\"none\"))",
            ["Northwind", "none", "none"]);
    }

    [Check("nested-templates-write-every-badge")]
    static void NestedTemplatesWriteEveryBadge()
    {
        Try(Make("Join", Make("Upper", Make("OrElse", Make("Field", "company"), Make("Field", "city"))),
                Make("Join", Make("Words", ": "), Make("Field", "name"))),
            "Join(Upper(OrElse(Field(\"company\"), Field(\"city\"))), Join(Words(\": \"), Field(\"name\")))",
            ["NORTHWIND: Ana Silva", "OSLO: Tom Berg", ": Lea Roy"]);
        Try(Make("OrElse", Make("Field", "company"), Make("OrElse", Make("Field", "city"), Make("Upper", Make("Field", "name")))),
            "OrElse(Field(\"company\"), OrElse(Field(\"city\"), Upper(Field(\"name\"))))",
            ["Northwind", "Oslo", "LEA ROY"]);
        Try(Make("Upper", Make("Join", Make("Field", "name"),
                Make("Join", Make("Words", " of "), Make("OrElse", Make("Field", "company"), Make("Words", "no company"))))),
            "Upper(Join(Field(\"name\"), Join(Words(\" of \"), OrElse(Field(\"company\"), Words(\"no company\")))))",
            ["ANA SILVA OF NORTHWIND", "TOM BERG OF NO COMPANY", "LEA ROY OF NO COMPANY"]);
    }

    [Check("the-printer-only-keeps-templates")]
    static void ThePrinterOnlyKeepsTemplates()
    {
        var text = Code.Type("BadgeText").Clr;
        var kept = typeof(BadgePrinter).GetFields(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .Count(f => f.FieldType != typeof(object) && (f.FieldType.IsAssignableFrom(text) || text.IsAssignableFrom(f.FieldType)));
        Expect.That(kept >= 3, "noTemplates", new { kept });

        var printer = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "BadgePrinter");
        var written = printer.SelectMany(d => d.DescendantNodes()).FirstOrDefault(n =>
            n is IfStatementSyntax or ConditionalExpressionSyntax or SwitchStatementSyntax or SwitchExpressionSyntax
                or InterpolatedStringExpressionSyntax
            || n is BinaryExpressionSyntax { OperatorToken.ValueText: "+" }
            || n is InvocationExpressionSyntax call && call.Expression.ToString().Contains("ToUpper"));
        Expect.That(written is null, "printerStillWrites", new { code = written?.ToString().Split('\n')[0].Trim() });
    }

    [Check("each-word-writes-itself")]
    static void EachWordWritesItself()
    {
        var text = Code.Type("BadgeText").Clr;
        foreach (var name in Kinds)
            Expect.That(WorksItOut(Code.Type(name).Clr, text, "Write"), "notItsOwnWrite", new { type = name });

        var test = TypeTest(Kinds);
        Expect.That(test is null, "typeTest", new { code = test });
    }

    static readonly string[] Kinds = ["Words", "Field", "Upper", "Join", "OrElse"];

    // Writes the template for each of the three attendees and compares the text.
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

    // The class works out its own answer: the method is written in the class, or in a class of its own between it and the base.
    static bool WorksItOut(Type type, Type @base, string method)
    {
        if (!@base.IsAssignableFrom(type)) return false;
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType != @base && found.DeclaringType != typeof(object);
    }

    // The first piece of code that tests whether something is one of the named classes; null when there is none.
    static string? TypeTest(string[] names)
    {
        static string Name(SyntaxNode? n) => n switch
        {
            QualifiedNameSyntax q => q.Right.Identifier.ValueText,
            SimpleNameSyntax s => s.Identifier.ValueText,
            _ => "",
        };

        foreach (var node in Source.Root.DescendantNodes())
        {
            SyntaxNode? named = node switch
            {
                BinaryExpressionSyntax b when b.OperatorToken.ValueText is "is" or "as" => b.Right,
                DeclarationPatternSyntax d => d.Type,
                RecursivePatternSyntax r => r.Type,
                TypePatternSyntax t => t.Type,
                ConstantPatternSyntax c => c.Expression,
                CaseSwitchLabelSyntax c => c.Value,
                TypeOfExpressionSyntax t => t.Type,
                _ => null,
            };
            if (named is not null && names.Contains(Name(named))) return node.ToString();
        }
        return null;
    }
}
