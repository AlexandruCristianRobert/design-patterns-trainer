using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class AdventureReplyChecks
{
    static Player Carrying(string name, int gold, params string[] items)
    {
        var player = new Player(name, gold);
        foreach (var item in items) player.Pick(item);
        return player;
    }

    // Three players, each with the words the failure messages use for them.
    static (Player Player, string Said)[] Players() =>
    [
        (Carrying("Ana", 12, "lamp"), "Ana, with 12 gold and a lamp"),
        (Carrying("Bo", 0, "key", "lamp"), "Bo, with no gold, a key and a lamp"),
        (Carrying("Cy", 50), "Cy, with 50 gold and nothing else"),
    ];

    // Writes the reply for each of the three players.
    static void Try(Reply reply, string written, string[] expected)
    {
        var players = Players();
        for (var i = 0; i < players.Length; i++)
        {
            var actual = reply.Text(players[i].Player);
            Expect.That(actual == expected[i], "wrongText", new { reply = written, player = players[i].Said, expected = expected[i], actual });
        }
    }

    [Check("simple-parts-write-their-text")]
    static void SimplePartsWriteTheirText()
    {
        var player = new Player("Dee", 3);
        Expect.That(!player.Carries("lamp"), "carriesTooSoon");
        player.Pick("lamp");
        Expect.That(player.Carries("lamp") && !player.Carries("key"), "wrongCarries");

        Try(new Say("Hello."), "Say(\"Hello.\")", ["Hello.", "Hello.", "Hello."]);
        Try(new PlayerName(), "PlayerName()", ["Ana", "Bo", "Cy"]);
        Try(new GoldCount(), "GoldCount()", ["12", "0", "50"]);
    }

    [Check("joining-parts-ask-the-parts-they-hold")]
    static void JoiningPartsAskThePartsTheyHold()
    {
        Try(new Then(new Say("Hi "), new PlayerName()), "Then(Say(\"Hi \"), PlayerName())", ["Hi Ana", "Hi Bo", "Hi Cy"]);
        Try(new IfCarrying("lamp", new Say("You see a door."), new Say("It is dark.")),
            "IfCarrying(\"lamp\", Say(\"You see a door.\"), Say(\"It is dark.\"))", ["You see a door.", "You see a door.", "It is dark."]);
        Try(new IfGoldAtLeast(20, new Say("Welcome!"), new Say("Go away.")),
            "IfGoldAtLeast(20, Say(\"Welcome!\"), Say(\"Go away.\"))", ["Go away.", "Go away.", "Welcome!"]);
        Try(new IfGoldAtLeast(12, new GoldCount(), new PlayerName()), "IfGoldAtLeast(12, GoldCount(), PlayerName())", ["12", "Bo", "50"]);
    }

    [Check("nested-replies-fit-every-player")]
    static void NestedRepliesFitEveryPlayer()
    {
        Try(new IfCarrying("lamp",
                new Then(new Say("By lamplight, "), new IfCarrying("key", new Say("you unlock the door."), new Say("you see a locked door."))),
                new Say("It is too dark to see.")),
            "IfCarrying(\"lamp\", Then(Say(\"By lamplight, \"), IfCarrying(\"key\", Say(\"you unlock the door.\"), Say(\"you see a locked door.\"))), Say(\"It is too dark to see.\"))",
            ["By lamplight, you see a locked door.", "By lamplight, you unlock the door.", "It is too dark to see."]);
        Try(new Then(new PlayerName(), new Then(new Say(" has "), new IfGoldAtLeast(1, new Then(new GoldCount(), new Say(" gold")), new Say("no gold")))),
            "Then(PlayerName(), Then(Say(\" has \"), IfGoldAtLeast(1, Then(GoldCount(), Say(\" gold\")), Say(\"no gold\"))))",
            ["Ana has 12 gold", "Bo has no gold", "Cy has 50 gold"]);
        Try(new IfGoldAtLeast(10,
                new IfCarrying("key", new Say("The guard lets you pass."), new Then(new Say("The guard sells you a key, "), new Then(new PlayerName(), new Say(".")))),
                new Say("The guard ignores you.")),
            "IfGoldAtLeast(10, IfCarrying(\"key\", Say(\"The guard lets you pass.\"), Then(Say(\"The guard sells you a key, \"), Then(PlayerName(), Say(\".\")))), Say(\"The guard ignores you.\"))",
            ["The guard sells you a key, Ana.", "The guard ignores you.", "The guard sells you a key, Cy."]);
    }

    [Check("each-part-writes-itself")]
    static void EachPartWritesItself()
    {
        var parts = new[] { typeof(Say), typeof(PlayerName), typeof(GoldCount), typeof(Then), typeof(IfCarrying), typeof(IfGoldAtLeast) };
        ExpectOwnWork(typeof(Reply), parts, "Text", ["Player"]);

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
