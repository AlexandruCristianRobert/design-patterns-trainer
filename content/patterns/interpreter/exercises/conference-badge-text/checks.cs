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
        var words = Kinds.Select(n => Code.Type(n).Clr).ToArray();

        // The templates a new printer keeps: in its fields, or in a collection (an array, a list or a dictionary's values).
        var made = new BadgePrinter();
        var templates = new List<object>();
        foreach (var field in typeof(BadgePrinter).GetFields(BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic))
        {
            var value = field.GetValue(field.IsStatic ? null : made);
            if (value is null || value is string) continue;
            if (text.IsInstanceOfType(value)) templates.Add(value);
            else if (value is System.Collections.IEnumerable items)
                foreach (var item in items)
                {
                    var kept = item is not null && item.GetType().IsGenericType && item.GetType().GetGenericTypeDefinition() == typeof(KeyValuePair<,>)
                        ? item.GetType().GetProperty("Value")!.GetValue(item)
                        : item;
                    if (kept is not null && text.IsInstanceOfType(kept)) templates.Add(kept);
                }
        }
        Expect.That(templates.Count >= 3, "noTemplates", new { kept = templates.Count });
        var odd = templates.FirstOrDefault(t => !words.Contains(t.GetType()));
        Expect.That(odd is null, "notMadeOfWords", new { type = odd?.GetType().Name });

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
        ExpectOwnWork(text, Kinds.Select(n => Code.Type(n).Clr).ToArray(), "Write");

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

    // ---- Each part has its own method ----

    // Each part is a base type with its own method. The base has no code, and the only other classes of the base type
    // are abstract classes in between, with no code either. Fields and properties do not count as code.
    static void ExpectOwnWork(Type @base, Type[] parts, string method)
    {
        foreach (var type in parts)
        {
            Expect.That(@base.IsAssignableFrom(type), "notAPart", new { type = type.Name });
            Expect.That(Declares(type, @base, method), "notItsOwn", new { type = type.Name });
        }

        var code = CodeIn(@base);
        Expect.That(code is null, "baseHasCode", new { member = code });

        foreach (var extra in CheckContext.Current.Assembly.GetTypes().Where(t =>
                     t != @base && @base.IsAssignableFrom(t) && !parts.Contains(t) && !t.Name.Contains('<')
                     && !t.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute))))
        {
            Expect.That(extra.IsAbstract, "extraPart", new { type = extra.Name });
            var inBetween = CodeIn(extra);
            Expect.That(inBetween is null, "betweenHasCode", new { type = extra.Name, member = inBetween });
        }
    }

    // The first method the type itself writes with a body, not counting property accessors; null when there is none.
    static string? CodeIn(Type type) =>
        type.GetMethods(BindingFlags.DeclaredOnly | BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(m => !m.IsAbstract && !m.IsSpecialName && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)))
            ?.Name;

    // The method is written in the class itself.
    static bool Declares(Type type, Type @base, string method)
    {
        MethodInfo? found;
        if (@base.IsInterface)
        {
            var map = type.GetInterfaceMap(@base);
            var i = Array.FindIndex(map.InterfaceMethods, m => m.Name == method);
            found = i < 0 ? null : map.TargetMethods[i];
        }
        else found = type.GetMethods(BindingFlags.Public | BindingFlags.Instance).FirstOrDefault(m => m.Name == method);
        return found is { IsAbstract: false } && found.DeclaringType == type;
    }

    static string CalledName(InvocationExpressionSyntax call) => call.Expression switch
    {
        MemberAccessExpressionSyntax m => m.Name.Identifier.ValueText,
        MemberBindingExpressionSyntax b => b.Name.Identifier.ValueText,
        SimpleNameSyntax s => s.Identifier.ValueText,
        _ => "",
    };

    // The first piece of code that tests which class something is: is, as, a type pattern, typeof or nameof on one
    // of the named classes, or GetType() inside one of them; null when there is none.
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
            if (node is InvocationExpressionSyntax call)
            {
                if (CalledName(call) == "GetType" && call.ArgumentList.Arguments.Count == 0
                    && call.Ancestors().OfType<TypeDeclarationSyntax>().Any(d => names.Contains(d.Identifier.ValueText))) return call.ToString();
                if (call.Expression is IdentifierNameSyntax { Identifier.ValueText: "nameof" }
                    && call.ArgumentList.Arguments.Any(a => names.Contains(Name(a.Expression)))) return call.ToString();
                continue;
            }
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
