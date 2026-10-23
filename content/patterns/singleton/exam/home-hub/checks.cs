using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class HomeHubChecks
{
    // Reads the public static property `member` of `owner` through reflection, so that nothing touches it earlier.
    static object Shared(Type owner, string member)
    {
        var property = owner.GetProperty(member, BindingFlags.Static | BindingFlags.Public);
        if (property is null || property.GetMethod is not { IsPublic: true }) Expect.Fail("noSharedMember", new { owner = owner.Name, member });
        var value = property.GetValue(null);
        if (value is null) Expect.Fail("sharedIsNull", new { owner = owner.Name, member });
        Expect.That(owner.IsInstanceOfType(value), "sharedWrongType", new { owner = owner.Name, member, actual = value.GetType().Name });
        return value;
    }

    // Reads `owner.member` three times and expects the very same object every time.
    static object SameEveryTime(Type owner, string member)
    {
        var first = Shared(owner, member);
        for (var i = 0; i < 2; i++)
            Expect.That(ReferenceEquals(first, Shared(owner, member)), "notSameObject", new { owner = owner.Name, member });
        return first;
    }

    // Only `owner` can create an `owner`: every constructor is private, and every public static method
    // that hands one out takes no parameters and returns the same object on every call.
    static void NoOutsideConstruction(Type owner)
    {
        var open = owner.GetConstructors(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic).Any(c => !c.IsPrivate);
        Expect.That(!open, "constructorNotPrivate", new { owner = owner.Name });
        foreach (var method in owner.GetMethods(BindingFlags.Static | BindingFlags.Public))
        {
            if (method.ReturnType == typeof(object) || !method.ReturnType.IsAssignableFrom(owner) || method.ContainsGenericParameters) continue;
            var name = method.IsSpecialName && method.Name.StartsWith("get_") ? method.Name[4..] : method.Name;
            Expect.That(method.GetParameters().Length == 0, "staticMakerTakesParameters", new { owner = owner.Name, method = name });
            Expect.That(ReferenceEquals(method.Invoke(null, null), method.Invoke(null, null)), "staticMakerNew", new { owner = owner.Name, method = name });
        }
    }

    // A type as written in the source, without spaces, nullable marks or the System namespaces.
    static string Bare(TypeSyntax type) =>
        string.Concat(type.ToString().Where(c => !char.IsWhiteSpace(c) && c != '?'))
            .Replace("global::", "").Replace("System.Threading.", "").Replace("System.", "");

    static bool InStaticConstructor(SyntaxNode node) =>
        node.Ancestors().OfType<ConstructorDeclarationSyntax>().Any(c => c.Modifiers.Any(SyntaxKind.StaticKeyword));

    // Reads from the source how `owner` keeps the object it hands out. Accepted: a thread-safe Lazy<T>;
    // a static field or property initializer, or an assignment in a static constructor; or an assignment inside a lock
    // that looks at the field again first, with every read outside the lock through a volatile field, Volatile.Read or Interlocked.
    // With `untilFirstUse`, an initializer also needs an explicit static constructor, or the runtime may run it early.
    static void SafeCreation(Type owner, bool untilFirstUse = false)
    {
        var declaration = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().FirstOrDefault(t => t.Identifier.ValueText == owner.Name);
        if (declaration is null) Expect.Fail("typeNotFound", new { type = owner.Name });
        var kinds = owner.GetInterfaces().Select(i => i.Name).Append(owner.Name).ToHashSet();
        bool Holds(TypeSyntax t) => kinds.Contains(Bare(t));
        bool HoldsLazy(TypeSyntax t) => kinds.Any(k => Bare(t) == $"Lazy<{k}>");

        var fields = declaration.DescendantNodes().OfType<FieldDeclarationSyntax>().Where(f => f.Modifiers.Any(SyntaxKind.StaticKeyword)).ToList();
        var properties = declaration.DescendantNodes().OfType<PropertyDeclarationSyntax>()
            .Where(p => p.Modifiers.Any(SyntaxKind.StaticKeyword) && p.ExpressionBody is null
                && p.AccessorList is { } list && list.Accessors.All(a => a.Body is null && a.ExpressionBody is null))
            .ToList();

        var lazyStarts = fields.Where(f => HoldsLazy(f.Declaration.Type)).SelectMany(f => f.Declaration.Variables).Select(v => v.Initializer?.Value)
            .Concat(properties.Where(p => HoldsLazy(p.Type)).Select(p => p.Initializer?.Value))
            .ToList();
        if (lazyStarts.Count > 0)
        {
            var creations = declaration.DescendantNodes().OfType<ObjectCreationExpressionSyntax>().Where(o => Bare(o.Type).StartsWith("Lazy<"))
                .Cast<BaseObjectCreationExpressionSyntax>().Concat(lazyStarts.OfType<ImplicitObjectCreationExpressionSyntax>());
            var unsafeMode = creations.SelectMany(c => c.ArgumentList?.Arguments ?? default).Select(a => a.Expression.ToString())
                .Any(s => s == "false" || s.EndsWith("None") || s.EndsWith("PublicationOnly"));
            Expect.That(!unsafeMode, "lazyNotSafe", new { owner = owner.Name });
            return;
        }

        var held = fields.Where(f => Holds(f.Declaration.Type))
            .SelectMany(f => f.Declaration.Variables.Select(v => (Name: v.Identifier.ValueText, Node: (SyntaxNode)v, Start: v.Initializer?.Value, Volatile: f.Modifiers.Any(SyntaxKind.VolatileKeyword))))
            .Concat(properties.Where(p => Holds(p.Type)).Select(p => (Name: p.Identifier.ValueText, Node: (SyntaxNode)p, Start: p.Initializer?.Value, Volatile: false)))
            .ToList();

        var kept = false;
        foreach (var h in held)
        {
            var refs = declaration.DescendantNodes().OfType<IdentifierNameSyntax>().Where(n => n.Identifier.ValueText == h.Name).ToList();
            SyntaxNode Target(IdentifierNameSyntax n) => n.Parent is MemberAccessExpressionSyntax m && m.Name == n ? m : n;
            bool IsWrite(IdentifierNameSyntax n) => Target(n).Parent switch
            {
                AssignmentExpressionSyntax a => a.Left == Target(n),
                ArgumentSyntax arg => !arg.RefKindKeyword.IsKind(SyntaxKind.None)
                    && arg.Parent?.Parent is not InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "Read" } },
                _ => false,
            };
            var writes = refs.Where(IsWrite).ToList();
            var initial = h.Start is not null && !h.Start.IsKind(SyntaxKind.NullLiteralExpression);
            if (!initial && writes.Count == 0) continue;
            kept = true;

            var locked = false;
            foreach (var w in writes)
            {
                if (InStaticConstructor(w)) { initial = true; continue; }
                var gate = w.FirstAncestorOrSelf<LockStatementSyntax>();
                Expect.That(gate is not null, "createdWithoutGuard", new { owner = owner.Name, field = h.Name });
                var looksFirst = Target(w).Parent is AssignmentExpressionSyntax a && a.IsKind(SyntaxKind.CoalesceAssignmentExpression)
                    || Target(w).Parent is ArgumentSyntax { Parent.Parent: InvocationExpressionSyntax { Expression: MemberAccessExpressionSyntax { Name.Identifier.ValueText: "CompareExchange" } } }
                    || refs.Any(r => r != w && r.SpanStart < w.SpanStart && r.FirstAncestorOrSelf<LockStatementSyntax>() == gate);
                Expect.That(looksFirst, "notCheckedInsideLock", new { owner = owner.Name, field = h.Name });
                locked = true;
            }

            if (locked)
                foreach (var r in refs.Where(r => r.FirstAncestorOrSelf<LockStatementSyntax>() is null && !IsWrite(r) && !InStaticConstructor(r)))
                {
                    var guarded = h.Volatile || r.Ancestors().OfType<InvocationExpressionSyntax>()
                        .Any(i => i.Expression.ToString() is var e && (e.EndsWith("Volatile.Read") || e.Contains("Interlocked.")));
                    Expect.That(guarded, "readOutsideLock", new { owner = owner.Name, field = h.Name });
                }

            if (initial && untilFirstUse)
            {
                var home = h.Node.FirstAncestorOrSelf<TypeDeclarationSyntax>()!;
                var staticConstructor = home.Members.OfType<ConstructorDeclarationSyntax>().Any(c => c.Modifiers.Any(SyntaxKind.StaticKeyword));
                Expect.That(staticConstructor, "mayBeCreatedEarly", new { owner = owner.Name, field = h.Name });
            }
        }
        Expect.That(kept, "nothingKept", new { owner = owner.Name });
    }

    static HomeHub Hub() => (HomeHub)Shared(typeof(HomeHub), "Main");

    [Check("every-read-gives-the-same-hub")]
    static void EveryReadGivesTheSameHub() => SameEveryTime(typeof(HomeHub), "Main");

    // Every Check that changes the heating puts it back, so the starting value holds whatever ran before.
    [Check("heating-starts-at-20")]
    static void HeatingStartsAt20()
    {
        var heating = Hub().Heating;

        Expect.That(heating == 20, "wrongStart", new { actual = heating });
    }

    [Check("voice-change-shows-on-the-panel")]
    static void VoiceChangeShowsOnThePanel()
    {
        var before = Hub().Heating;
        try
        {
            var said = new VoiceAssistant().Heat(23);
            Expect.That(said == "Heating set to 23", "wrongHeatReply", new { actual = said });
            var shown = new WallPanel().Show("Test room");
            Expect.That(shown == "Panel | Test room: lights off, heating 23", "heatNotShown", new { actual = shown });
            Expect.That(Hub().Heating == 23, "heatNotKept", new { actual = Hub().Heating });
        }
        finally
        {
            Hub().SetHeating(before);
        }
    }

    [Check("lights-are-kept-per-room")]
    static void LightsAreKeptPerRoom()
    {
        var said = new VoiceAssistant().Lights("Test hall", true);
        Expect.That(said == "Lights in Test hall on", "wrongLightsReply", new { actual = said });

        var heating = Hub().Heating;
        var hall = new WallPanel().Show("Test hall");
        Expect.That(hall == $"Panel | Test hall: lights on, heating {heating}", "lightsNotShown", new { room = "Test hall", expected = $"Panel | Test hall: lights on, heating {heating}", actual = hall });
        var attic = new WallPanel().Show("Test attic");
        Expect.That(attic == $"Panel | Test attic: lights off, heating {heating}", "lightsNotShown", new { room = "Test attic", expected = $"Panel | Test attic: lights off, heating {heating}", actual = attic });

        new VoiceAssistant().Lights("Test hall", false);
        hall = new WallPanel().Show("Test hall");
        Expect.That(hall == $"Panel | Test hall: lights off, heating {heating}", "lightsStayOn", new { actual = hall });
    }

    [Check("no-second-hub")]
    static void NoSecondHub() => NoOutsideConstruction(typeof(HomeHub));

    [Check("hub-is-created-safely")]
    static void HubIsCreatedSafely() => SafeCreation(typeof(HomeHub));
}
