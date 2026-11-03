using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class EscapeKeyChecks
{
    [Check("escape-closes-what-is-open")]
    static void EscapeClosesWhatIsOpen()
    {
        var export = new EscapeKey().Press(new EditorView(true, "", 0));
        Expect.That(export == "Export dialog closed", "wrongClose",
            new { open = "the export dialog", expected = "Export dialog closed", actual = export });

        var trim = new EscapeKey().Press(new EditorView(false, "outro.mov", 0));
        Expect.That(trim == "Trim of outro.mov cancelled", "wrongClose",
            new { open = "a trim of outro.mov", expected = "Trim of outro.mov cancelled", actual = trim });

        var selected = new EscapeKey().Press(new EditorView(false, "", 4));
        Expect.That(selected == "4 clips unselected", "wrongClose",
            new { open = "4 selected clips", expected = "4 clips unselected", actual = selected });
    }

    [Check("only-the-first-open-thing-closes")]
    static void OnlyTheFirstOpenThingCloses()
    {
        var key = new EscapeKey();
        var all = key.Press(new EditorView(true, "intro.mp4", 3));
        Expect.That(all == "Export dialog closed", "wrongFirst",
            new { open = "the export dialog, a trim and 3 selected clips", expected = "Export dialog closed", actual = all });

        var trimAndClips = key.Press(new EditorView(false, "intro.mp4", 3));
        Expect.That(trimAndClips == "Trim of intro.mp4 cancelled", "wrongFirst",
            new { open = "a trim of intro.mp4 and 3 selected clips", expected = "Trim of intro.mp4 cancelled", actual = trimAndClips });

        var exportAndClips = key.Press(new EditorView(true, "", 2));
        Expect.That(exportAndClips == "Export dialog closed", "wrongFirst",
            new { open = "the export dialog and 2 selected clips", expected = "Export dialog closed", actual = exportAndClips });
    }

    [Check("nothing-open-nothing-closed")]
    static void NothingOpenNothingClosed()
    {
        var nothing = new EscapeKey().Press(new EditorView(false, "", 0));
        Expect.That(nothing == "Nothing to close", "wrongNothing", new { expected = "Nothing to close", actual = nothing });
    }

    [Check("parts-know-only-the-next")]
    static void PartsKnowOnlyTheNext()
    {
        var link = typeof(EditorPart);
        foreach (var type in new[] { typeof(ExportDialog), typeof(TrimTool), typeof(ClipSelection) })
        {
            Expect.That(link.IsAssignableFrom(type), "notAPart", new { type = type.Name });
            Expect.That(FieldsOf(type).Any(f => !f.IsStatic && HoldsOne(f.FieldType, link)), "noNext", new { type = type.Name });
        }

        var held = FieldsOf(typeof(EscapeKey)).Count(f => HoldsOne(f.FieldType, link));
        Expect.That(held == 1, "keyHoldsMore", new { held });

        foreach (var type in link.Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField))
                Expect.That(!HoldsMany(field.FieldType, link), "keptInACollection", new { type = type.Name, field = field.Name });

        var written = CollectionInSource(["EditorPart", "ExportDialog", "TrimTool", "ClipSelection"]);
        Expect.That(written is null, "collectionInCode", new { written });

        var loop = LoopCalling("OnEscape");
        Expect.That(loop is null, "loopCallsEach", new { loop });
    }

    // ---- Who holds which link ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every field of a type: its own and the ones it inherits, private ones included.
    static IEnumerable<FieldInfo> FieldsOf(Type type)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            foreach (var field in t.GetFields(AnyField))
                yield return field;
    }

    // A field of this type can hold one link.
    static bool HoldsOne(Type fieldType, Type link) => fieldType != typeof(object) && fieldType.IsAssignableFrom(link);

    // A field of this type holds many links: an array or a collection of them.
    static bool HoldsMany(Type fieldType, Type link)
    {
        bool IsLink(Type t) => t != typeof(object) && (t.IsAssignableFrom(link) || link.IsAssignableFrom(t));
        if (fieldType.IsArray) return IsLink(fieldType.GetElementType()!);
        return fieldType.GetInterfaces().Append(fieldType)
            .Where(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IEnumerable<>))
            .Any(i => IsLink(i.GetGenericArguments()[0]));
    }

    // The first type written in the code that collects links, such as List<EditorPart> or EditorPart[]; null when there is none.
    static string? CollectionInSource(string[] names)
    {
        bool Mentions(SyntaxNode node) =>
            node.DescendantNodesAndSelf().OfType<IdentifierNameSyntax>().Any(n => names.Contains(n.Identifier.ValueText));
        foreach (var node in Source.Root.DescendantNodes())
        {
            if (node is GenericNameSyntax generic && generic.TypeArgumentList.Arguments.Any(Mentions)) return generic.ToString();
            if (node is ArrayTypeSyntax array && Mentions(array.ElementType)) return array.ToString();
        }
        return null;
    }

    // The first loop or lambda inside a class that calls the given method, such as a foreach over the links; null when there is none.
    static string? LoopCalling(string method)
    {
        bool Calls(SyntaxNode node) => node.DescendantNodes().OfType<InvocationExpressionSyntax>().Any(i =>
            i.Expression is MemberAccessExpressionSyntax access && access.Name.Identifier.ValueText == method
            || i.Expression is MemberBindingExpressionSyntax binding && binding.Name.Identifier.ValueText == method);
        var loop = Source.Root.DescendantNodes().Where(n => n.Ancestors().OfType<TypeDeclarationSyntax>().Any()).FirstOrDefault(n =>
            n is ForEachStatementSyntax or ForStatementSyntax or WhileStatementSyntax or DoStatementSyntax or LambdaExpressionSyntax && Calls(n));
        return loop?.ToString().Split('\n')[0].Trim();
    }
}
