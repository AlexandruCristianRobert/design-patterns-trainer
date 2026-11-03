using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BudgetSheetsChecks
{
    // A kind of sheet the program has never seen. Every copy it makes joins a shared list, so a
    // shelf that also keeps a copy of its own in Put is still recognised.
    sealed class TestSheet(List<TestSheet> made) : ISheet
    {
        public List<string> Categories { get; } = [];
        public Limit Limit { get; } = new(1);

        public string Describe() => "test sheet";

        public ISheet Copy()
        {
            var copy = new TestSheet(made);
            made.Add(copy);
            return copy;
        }
    }

    // One sheet of each kind, already set up with categories.
    static ISheet[] Samples()
    {
        var spending = new SpendingSheet("EUR", 900);
        spending.Categories.AddRange(["rent", "food"]);

        var savings = new SavingsSheet("GBP", 150, 2000);
        savings.Categories.AddRange(["bike", "holiday"]);

        return [spending, savings];
    }

    [Check("sheets-describe-themselves")]
    static void SheetsDescribeThemselves()
    {
        var spending = new SpendingSheet("EUR", 900);
        spending.Categories.AddRange(["rent", "food", "transport"]);
        var savings = new SavingsSheet("GBP", 150, 2000);
        savings.Categories.AddRange(["bike", "holiday"]);
        var empty = new SpendingSheet("RON", 400);

        Expect.That(spending.Describe() == "spending in EUR, at most 900 a month: rent, food, transport", "wrongSpending", new { expected = "spending in EUR, at most 900 a month: rent, food, transport", actual = spending.Describe() });
        Expect.That(savings.Describe() == "savings in GBP towards 2000, 150 a month: bike, holiday", "wrongSavings", new { expected = "savings in GBP towards 2000, 150 a month: bike, holiday", actual = savings.Describe() });
        Expect.That(empty.Describe() == "spending in RON, at most 400 a month: no categories", "wrongEmpty", new { expected = "spending in RON, at most 400 a month: no categories", actual = empty.Describe() });
    }

    [Check("copies-keep-their-kind")]
    static void CopiesKeepTheirKind()
    {
        foreach (var sheet in Samples())
        {
            var type = sheet.GetType().Name;
            var copy = sheet.Copy();
            Expect.That(copy is not null && !ReferenceEquals(copy, sheet), "sameObject", new { type });
            Expect.That(copy!.GetType() == sheet.GetType(), "wrongKind", new { type, actual = copy.GetType().Name });
            Expect.That(copy.Describe() == sheet.Describe(), "differentCopy", new { type, expected = sheet.Describe(), actual = copy.Describe() });
        }
    }

    [Check("copies-are-independent")]
    static void CopiesAreIndependent()
    {
        foreach (var sheet in Samples())
        {
            var type = sheet.GetType().Name;
            var before = sheet.Describe();
            var copy = sheet.Copy();

            copy.Categories.Add("pets");
            copy.Categories.Remove(copy.Categories[0]);
            Expect.That(sheet.Describe() == before, "sharedCategories", new { type, actual = sheet.Describe() });

            copy.Limit.Monthly = 5;
            Expect.That(sheet.Describe() == before, "sharedLimit", new { type, actual = sheet.Describe() });
        }
    }

    [Check("take-hands-out-a-fresh-sheet")]
    static void TakeHandsOutAFreshSheet()
    {
        foreach (var sheet in Samples())
        {
            var type = sheet.GetType().Name;
            var shelf = new SheetShelf();
            shelf.Put("starter", sheet);
            var before = sheet.Describe();

            var first = shelf.Take("starter");
            Expect.That(first is not null && !ReferenceEquals(first, sheet), "takeSameObject", new { type });
            Expect.That(first!.GetType() == sheet.GetType(), "takeWrongKind", new { type, actual = first.GetType().Name });

            first.Categories.Add("gifts");
            first.Limit.Monthly = 7;
            var second = shelf.Take("starter");
            Expect.That(sheet.Describe() == before, "storedChanged", new { type, actual = sheet.Describe() });
            Expect.That(!ReferenceEquals(first, second) && second.Describe() == before, "secondChanged", new { type, actual = second.Describe() });
        }
    }

    [Check("take-rejects-unknown-names")]
    static void TakeRejectsUnknownNames()
    {
        var shelf = new SheetShelf();
        shelf.Put("household", new SpendingSheet("EUR", 1000));
        string outcome;
        try
        {
            shelf.Take("wedding");
            outcome = "no exception";
        }
        catch (KeyNotFoundException)
        {
            outcome = "KeyNotFoundException";
        }
        catch (Exception e)
        {
            outcome = e.GetType().Name;
        }
        Expect.That(outcome == "KeyNotFoundException", "unknownAccepted", new { expected = "KeyNotFoundException", actual = outcome });
    }

    [Check("take-works-for-any-sheet")]
    static void TakeWorksForAnySheet()
    {
        var made = new List<TestSheet>();
        var shelf = new SheetShelf();
        shelf.Put("test", new TestSheet(made));
        var before = made.Count;
        var taken = shelf.Take("test");
        var madeByTake = made.Skip(before).ToList();

        Expect.That(madeByTake.Any(copy => ReferenceEquals(copy, taken)), "notTheCopy", new { count = madeByTake.Count });
    }

    [Check("shelf-names-no-kind-of-sheet")]
    static void ShelfNamesNoKindOfSheet()
    {
        var classes = typeof(ISheet).Assembly.GetTypes()
            .Where(t => t.IsClass && typeof(ISheet).IsAssignableFrom(t) && t.DeclaringType != typeof(BudgetSheetsChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "SheetShelf"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "shelfNamesSheetClass", new { type = named });
        }
    }
}
