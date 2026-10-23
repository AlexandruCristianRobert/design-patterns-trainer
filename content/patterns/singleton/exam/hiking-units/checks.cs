using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class TrailUnitChecks
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

    // Reads from the source how `owner` keeps the object it hands out. Accepted: a Lazy<T> that is thread-safe and builds once;
    // a static field or property initializer, or an assignment in a static constructor; or an assignment inside a lock
    // that looks at the field (or a `field`-backed property) again first, with every read outside the lock through a volatile field, Volatile.Read or Interlocked.
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
            var modes = creations.SelectMany(c => c.ArgumentList?.Arguments ?? default).Select(a => a.Expression.ToString()).ToList();
            Expect.That(!modes.Any(s => s == "false" || s.EndsWith("None")), "lazyNotSafe", new { owner = owner.Name });
            Expect.That(!modes.Any(s => s.EndsWith("PublicationOnly")), "lazyMayBuildTwice", new { owner = owner.Name });
            return;
        }

        // A static property whose accessors use the C# 14 `field` keyword keeps the object in that backing field.
        static bool IsField(SyntaxNode n) => n.IsKind(SyntaxKind.FieldExpression) || n is IdentifierNameSyntax { Identifier.ValueText: "field" };
        var backed = declaration.DescendantNodes().OfType<PropertyDeclarationSyntax>()
            .Where(p => p.Modifiers.Any(SyntaxKind.StaticKeyword) && Holds(p.Type) && p.DescendantNodes().Any(IsField));

        var held = fields.Where(f => Holds(f.Declaration.Type))
            .SelectMany(f => f.Declaration.Variables.Select(v => (Name: v.Identifier.ValueText, Node: (SyntaxNode)v, Start: v.Initializer?.Value, Volatile: f.Modifiers.Any(SyntaxKind.VolatileKeyword), Backing: false)))
            .Concat(properties.Where(p => Holds(p.Type)).Select(p => (Name: p.Identifier.ValueText, Node: (SyntaxNode)p, Start: p.Initializer?.Value, Volatile: false, Backing: false)))
            .Concat(backed.Select(p => (Name: $"{p.Identifier.ValueText}.field", Node: (SyntaxNode)p, Start: p.Initializer?.Value, Volatile: false, Backing: true)))
            .ToList();

        var kept = false;
        foreach (var h in held)
        {
            var refs = h.Backing
                ? h.Node.DescendantNodes().Where(IsField).Cast<ExpressionSyntax>().ToList()
                : declaration.DescendantNodes().OfType<IdentifierNameSyntax>().Where(n => n.Identifier.ValueText == h.Name).Cast<ExpressionSyntax>().ToList();
            SyntaxNode Target(ExpressionSyntax n) => n.Parent is MemberAccessExpressionSyntax m && m.Name == n ? m : n;
            bool IsWrite(ExpressionSyntax n) => Target(n).Parent switch
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

    // Units the program has never seen. They show every distance as "<km> test units".
    sealed class TestUnits : IDistanceUnits
    {
        public string Show(int km) => $"{km} test units";
    }

    // The app's units, read through Current, as an IDistanceUnits.
    static IDistanceUnits Units()
    {
        var value = Shared(typeof(TrailUnits), "Current");
        if (value is IDistanceUnits units) return units;
        Expect.Fail("notUnits", new { owner = nameof(TrailUnits) });
        return null!;
    }

    static TrailUnits App() => (TrailUnits)Shared(typeof(TrailUnits), "Current");

    [Check("every-read-gives-the-same-units")]
    static void EveryReadGivesTheSameUnits() => SameEveryTime(typeof(TrailUnits), "Current");

    [Check("units-start-in-km-and-switch")]
    static void UnitsStartInKmAndSwitch()
    {
        var units = Units();
        var shown = units.Show(16);
        Expect.That(shown == "16 km", "wrongKm", new { actual = shown });
        try
        {
            App().UseMiles(true);
            shown = units.Show(16);
            Expect.That(shown == "10 mi", "wrongMiles", new { km = 16, expected = "10 mi", actual = shown });
            shown = units.Show(5);
            Expect.That(shown == "3 mi", "wrongMiles", new { km = 5, expected = "3 mi", actual = shown });
        }
        finally
        {
            App().UseMiles(false);
        }
        shown = units.Show(16);
        Expect.That(shown == "16 km", "switchBackLost", new { actual = shown });
    }

    [Check("card-uses-the-units-it-is-given")]
    static void CardUsesTheUnitsItIsGiven()
    {
        var card = TrailCard.Describe("Ridge loop", 12, new TestUnits());
        Expect.That(card == "Ridge loop: 12 test units", "wrongTestCard", new { actual = card });

        card = TrailCard.Describe("Ridge loop", 12, Units());
        Expect.That(card == "Ridge loop: 12 km", "wrongAppCard", new { actual = card });
    }

    [Check("switch-seen-by-every-card")]
    static void SwitchSeenByEveryCard()
    {
        try
        {
            App().UseMiles(true);
            var card = TrailCard.Describe("Lake path", 8, Units());
            Expect.That(card == "Lake path: 5 mi", "switchNotSeen", new { actual = card });
        }
        finally
        {
            App().UseMiles(false);
        }
    }

    [Check("no-second-units")]
    static void NoSecondUnits() => NoOutsideConstruction(typeof(TrailUnits));

    [Check("units-are-created-safely")]
    static void UnitsAreCreatedSafely() => SafeCreation(typeof(TrailUnits));
}
