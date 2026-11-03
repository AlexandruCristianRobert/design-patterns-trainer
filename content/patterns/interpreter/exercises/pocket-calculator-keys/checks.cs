using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PocketCalculatorChecks
{
    static Memory With(params (string Key, int Value)[] stored)
    {
        var memory = new Memory();
        foreach (var (key, value) in stored) memory.Store(key, value);
        return memory;
    }

    // Four memories, each with the words the failure messages use for it.
    static (Memory Memory, string Said)[] Memories() =>
    [
        (With(("M1", 5), ("M2", 3)), "M1 = 5 and M2 = 3"),
        (With(("M1", 10), ("M2", -2)), "M1 = 10 and M2 = -2"),
        (With(), "nothing stored"),
        (With(("M1", 0), ("M2", 7)), "M1 = 0 and M2 = 7"),
    ];

    // Works the formula out for each of the four memories.
    static void Try(Formula formula, string written, int[] expected)
    {
        var memories = Memories();
        for (var i = 0; i < memories.Length; i++)
        {
            var actual = formula.Value(memories[i].Memory);
            Expect.That(actual == expected[i], "wrongValue", new { formula = written, memory = memories[i].Said, expected = expected[i], actual });
        }
    }

    [Check("numbers-and-memory-keys")]
    static void NumbersAndMemoryKeys()
    {
        var memory = new Memory();
        memory.Store("M1", 4);
        memory.Store("M1", 9);
        Expect.That(memory.Get("M1") == 9, "wrongMemory", new { expected = 9, actual = memory.Get("M1") });

        Try(new Number(7), "Number(7)", [7, 7, 7, 7]);
        Try(new Recall("M1"), "Recall(\"M1\")", [5, 10, 0, 0]);
        Try(new Recall("M2"), "Recall(\"M2\")", [3, -2, 0, 7]);
        Try(new Recall("M3"), "Recall(\"M3\")", [0, 0, 0, 0]);
    }

    [Check("sums-work-on-their-two-parts-in-order")]
    static void SumsWorkOnTheirTwoPartsInOrder()
    {
        Try(new Add(new Recall("M1"), new Recall("M2")), "Add(Recall(\"M1\"), Recall(\"M2\"))", [8, 8, 0, 7]);
        Try(new Subtract(new Recall("M1"), new Number(4)), "Subtract(Recall(\"M1\"), Number(4))", [1, 6, -4, -4]);
        Try(new Subtract(new Number(4), new Recall("M1")), "Subtract(Number(4), Recall(\"M1\"))", [-1, -6, 4, 4]);
        Try(new Multiply(new Number(3), new Recall("M2")), "Multiply(Number(3), Recall(\"M2\"))", [9, -6, 0, 21]);
    }

    [Check("nested-formulas-work-out-every-memory")]
    static void NestedFormulasWorkOutEveryMemory()
    {
        Try(new Multiply(new Subtract(new Recall("M1"), new Number(4)), new Add(new Recall("M2"), new Multiply(new Number(2), new Recall("M1")))),
            "Multiply(Subtract(Recall(\"M1\"), Number(4)), Add(Recall(\"M2\"), Multiply(Number(2), Recall(\"M1\"))))", [13, 108, 0, -28]);
        Try(new Subtract(new Number(100), new Multiply(new Add(new Recall("M1"), new Number(1)), new Subtract(new Recall("M2"), new Recall("M1")))),
            "Subtract(Number(100), Multiply(Add(Recall(\"M1\"), Number(1)), Subtract(Recall(\"M2\"), Recall(\"M1\"))))", [112, 232, 100, 93]);
    }

    [Check("the-reader-builds-a-tree")]
    static void TheReaderBuildsATree()
    {
        void Read(string keys, Type top, int[] expected)
        {
            var formula = KeyReader.Read(keys);
            var made = formula?.GetType().Name ?? "null";
            Expect.That(made == top.Name, "wrongTop", new { keys, expected = top.Name, actual = made });
            Try(formula!, $"KeyReader.Read(\"{keys}\")", expected);
        }

        Read("7", typeof(Number), [7, 7, 7, 7]);
        Read("M2", typeof(Recall), [3, -2, 0, 7]);
        Read("10 3 -", typeof(Subtract), [7, 7, 7, 7]);
        Read("M1 2 + 3 *", typeof(Multiply), [21, 36, 6, 6]);
        Read("M1 4 - M2 2 M1 * + *", typeof(Multiply), [13, 108, 0, -28]);
        Read("100 M1 1 + M2 M1 - * -", typeof(Subtract), [112, 232, 100, 93]);
    }

    [Check("one-class-per-key")]
    static void OneClassPerKey()
    {
        var parts = new[] { typeof(Number), typeof(Recall), typeof(Add), typeof(Subtract), typeof(Multiply) };
        ExpectOwnWork(typeof(Formula), parts, "Value", ["Memory"]);

        var test = TypeTest(parts.Select(t => t.Name).ToArray());
        Expect.That(test is null, "typeTest", new { code = test });
    }

    // ---- Each part does all of its own work ----

    // Each part is a base type with its own method; the base has no code; no other class is a base type;
    // and no part calls a method written outside the parts, the base and the input types.
    static void ExpectOwnWork(Type @base, Type[] parts, string method, string[] inputs)
    {
        foreach (var type in parts)
        {
            Expect.That(@base.IsAssignableFrom(type), "notAPart", new { type = type.Name });
            Expect.That(Declares(type, @base, method), "notItsOwn", new { type = type.Name });
        }

        var code = @base.GetMethods(BindingFlags.DeclaredOnly | BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(m => !m.IsAbstract && !m.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)));
        Expect.That(code is null, "baseHasCode", new { member = code?.Name });

        var extra = CheckContext.Current.Assembly.GetTypes().FirstOrDefault(t =>
            t != @base && @base.IsAssignableFrom(t) && !parts.Contains(t) && !t.Name.Contains('<')
            && !t.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute)));
        Expect.That(extra is null, "extraPart", new { type = extra?.Name });

        var partNames = parts.Select(p => p.Name).ToHashSet();
        var allowed = partNames.Append(@base.Name).Concat(inputs).ToHashSet();
        var declarations = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().ToList();
        var outside = declarations.Where(d => !allowed.Contains(d.Identifier.ValueText))
            .SelectMany(d => d.Members.OfType<MethodDeclarationSyntax>()).Select(m => m.Identifier.ValueText).ToHashSet();
        var call = declarations.Where(d => partNames.Contains(d.Identifier.ValueText)).SelectMany(d => d.DescendantNodes())
            .FirstOrDefault(n => n is BaseExpressionSyntax || n is InvocationExpressionSyntax i && outside.Contains(CalledName(i)));
        Expect.That(call is null, "callsOutside", new { code = (call is BaseExpressionSyntax ? call.Parent : call)?.ToString() });
    }

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
    // of the named classes, or any GetType(); null when there is none.
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
                if (CalledName(call) == "GetType" && call.ArgumentList.Arguments.Count == 0) return call.ToString();
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
