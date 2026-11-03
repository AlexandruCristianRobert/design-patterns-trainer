using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ProfilePictureChecks
{
    [Check("each-source-gives-its-picture")]
    static void EachSourceGivesItsPicture()
    {
        var card = new ProfileCard();
        var upload = card.Picture(new Member("Bo", "bo-at-sea.png", ""));
        Expect.That(upload == "photo bo-at-sea.png", "wrongPicture",
            new { member = "Bo, with the upload bo-at-sea.png", expected = "photo bo-at-sea.png", actual = upload });

        var linked = card.Picture(new Member("Bo", "", "SnapShelf"));
        Expect.That(linked == "SnapShelf picture of Bo", "wrongPicture",
            new { member = "Bo, with the linked site SnapShelf", expected = "SnapShelf picture of Bo", actual = linked });

        var letter = card.Picture(new Member("  zoe", "", ""));
        Expect.That(letter == "letter Z", "wrongPicture",
            new { member = "\"  zoe\", with no upload and no linked site", expected = "letter Z", actual = letter });
    }

    [Check("first-source-in-order-wins")]
    static void FirstSourceInOrderWins()
    {
        var card = new ProfileCard();
        var all = card.Picture(new Member("Ana", "ana-beach.jpg", "PhotoHub"));
        Expect.That(all == "photo ana-beach.jpg", "wrongFirst",
            new { member = "Ana, with an upload and a linked site", expected = "photo ana-beach.jpg", actual = all });

        var linkedAndName = card.Picture(new Member("Ana", "", "PhotoHub"));
        Expect.That(linkedAndName == "PhotoHub picture of Ana", "wrongFirst",
            new { member = "Ana, with a linked site and no upload", expected = "PhotoHub picture of Ana", actual = linkedAndName });

        var uploadNoName = card.Picture(new Member("", "cat.gif", ""));
        Expect.That(uploadNoName == "photo cat.gif", "wrongFirst",
            new { member = "a member with no name and the upload cat.gif", expected = "photo cat.gif", actual = uploadNoName });
    }

    [Check("no-source-gives-the-grey-outline")]
    static void NoSourceGivesTheGreyOutline()
    {
        var card = new ProfileCard();
        var empty = card.Picture(new Member("", "", ""));
        Expect.That(empty == "grey outline", "wrongOutline",
            new { member = "an empty name", expected = "grey outline", actual = empty });

        var spaces = card.Picture(new Member("   ", "", ""));
        Expect.That(spaces == "grey outline", "wrongOutline",
            new { member = "a name of only spaces", expected = "grey outline", actual = spaces });
    }

    [Check("sources-know-only-the-next")]
    static void SourcesKnowOnlyTheNext()
    {
        var link = typeof(PictureSource);
        foreach (var type in new[] { typeof(UploadedPhoto), typeof(LinkedSitePhoto), typeof(NameInitial) })
        {
            Expect.That(link.IsAssignableFrom(type), "notASource", new { type = type.Name });
            Expect.That(FieldsOf(type).Any(f => !f.IsStatic && HoldsOne(f.FieldType, link)), "noNext", new { type = type.Name });
        }

        var held = FieldsOf(typeof(ProfileCard)).Count(f => HoldsOne(f.FieldType, link));
        Expect.That(held == 1, "cardHoldsMore", new { held });

        foreach (var type in link.Assembly.GetTypes())
            foreach (var field in type.GetFields(AnyField))
                Expect.That(!HoldsMany(field.FieldType, link), "keptInACollection", new { type = type.Name, field = field.Name });

        var written = CollectionInSource(["PictureSource", "UploadedPhoto", "LinkedSitePhoto", "NameInitial"]);
        Expect.That(written is null, "collectionInCode", new { written });

        var loop = LoopCalling("PictureOf");
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

    // The first type written in the code that collects links, such as List<PictureSource> or PictureSource[]; null when there is none.
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
