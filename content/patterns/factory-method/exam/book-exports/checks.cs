using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BookExportChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // No constructor of `owner` takes parameters, so nothing can be handed in from outside for it to use.
    static void NoConstructorParameters(Type owner)
    {
        var ctor = owner.GetConstructors(Instance).FirstOrDefault(c => c.GetParameters().Length > 0);
        Expect.That(ctor is null, "ownerTakesParameters", new { owner = owner.Name, parameters = ctor is null ? "" : string.Join(", ", ctor.GetParameters().Select(p => p.ParameterType.Name)) });
    }

    // The method `owner` declares that returns a `made`: abstract or virtual, public or protected, taking `parameters`.
    static MethodInfo MakingMethod(Type owner, Type made, params Type[] parameters)
    {
        var found = owner.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { owner = owner.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Select(p => p.ParameterType).SequenceEqual(parameters));
        if (method is null) Expect.Fail("makingMethodParameters", new { owner = owner.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { owner = owner.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsFamily || method.IsFamilyOrAssembly, "makingMethodPrivate", new { owner = owner.Name, method = method.Name });
        return method;
    }

    // Each subclass derives from `owner`, and neither it nor a class between them declares its own `operation`.
    static void OperationWrittenOnce(Type owner, string operation, params Type[] subclasses)
    {
        foreach (var sub in subclasses)
        {
            Expect.That(sub != owner && owner.IsAssignableFrom(sub), "notASubclass", new { type = sub.Name, owner = owner.Name });
            for (var t = sub; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Instance | BindingFlags.DeclaredOnly).Any(m => m.Name == operation),
                    "operationRedeclared", new { type = t.Name, method = operation });
        }
    }

    // The source of `owner` names none of the program's classes that implement `made`.
    static void NamesNoMadeClass(string owner, Type made)
    {
        var classes = made.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(BookExportChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == owner))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "ownerNamesMadeClass", new { owner, type = named });
        }
    }

    // Asks a new `type` twice through `making` and expects two new objects of class `expected`.
    static void MakesItsOwn(MethodInfo making, Type type, Type expected)
    {
        var ctor = type.GetConstructor(Type.EmptyTypes);
        if (ctor is null) Expect.Fail("noEmptyConstructor", new { type = type.Name });
        var instance = ctor.Invoke(null);
        var first = making.Invoke(instance, null);
        var second = making.Invoke(instance, null);
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type = type.Name, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = making.Name });
    }

    static string Entries(ILayout layout) => $"{layout.Chapter(1, "Home")} / {layout.Chapter(3, "Sea")} / {layout.Footer(3)}";

    [Check("layouts-lay-out-the-contents")]
    static void LayoutsLayOutTheContents()
    {
        var page = Entries(new PageLayout());
        var large = Entries(new LargePageLayout());
        var flow = Entries(new FlowLayout());

        Expect.That(page == "Chapter 1: Home, page 1 / Chapter 3: Sea, page 21 / 30 pages", "wrongPage", new { actual = page });
        Expect.That(large == "Chapter 1: Home, page 1 / Chapter 3: Sea, page 41 / 60 pages, large print", "wrongLarge", new { actual = large });
        Expect.That(flow == "1. Home / 3. Sea / 3 chapters, reflowable", "wrongFlow", new { actual = flow });
    }

    [Check("each-export-uses-its-layout")]
    static void EachExportUsesItsLayout()
    {
        List<string> chapters = ["The harbour", "Night train"];
        var print = new PrintExport().Export(chapters);
        var large = new LargePrintExport().Export(chapters);
        var ebook = new EbookExport().Export(chapters);

        Expect.That(print == "Chapter 1: The harbour, page 1 / Chapter 2: Night train, page 11 / 20 pages", "wrongPrint", new { actual = print });
        Expect.That(large == "Chapter 1: The harbour, page 1 / Chapter 2: Night train, page 21 / 40 pages, large print", "wrongLargePrint", new { actual = large });
        Expect.That(ebook == "1. The harbour / 2. Night train / 2 chapters, reflowable", "wrongEbook", new { actual = ebook });
    }

    [Check("empty-book-has-only-the-footer")]
    static void EmptyBookHasOnlyTheFooter()
    {
        var ebook = new EbookExport().Export([]);

        Expect.That(ebook == "0 chapters, reflowable", "wrongEmpty", new { actual = ebook });
    }

    [Check("large-print-is-a-print-edition")]
    static void LargePrintIsAPrintEdition()
    {
        Expect.That(typeof(PrintExport).IsAssignableFrom(typeof(LargePrintExport)), "largeNotPrint");
    }

    [Check("export-knows-only-ilayout")]
    static void ExportKnowsOnlyILayout()
    {
        var making = MakingMethod(typeof(BookExport), typeof(ILayout));
        NoConstructorParameters(typeof(BookExport));
        OperationWrittenOnce(typeof(BookExport), "Export", typeof(PrintExport), typeof(LargePrintExport), typeof(EbookExport));
        NamesNoMadeClass("BookExport", typeof(ILayout));
        MakesItsOwn(making, typeof(PrintExport), typeof(PageLayout));
        MakesItsOwn(making, typeof(LargePrintExport), typeof(LargePageLayout));
        MakesItsOwn(making, typeof(EbookExport), typeof(FlowLayout));
    }
}
