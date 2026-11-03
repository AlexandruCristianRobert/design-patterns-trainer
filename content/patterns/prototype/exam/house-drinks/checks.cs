using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class HouseDrinksChecks
{
    // A kind of drink the program has never seen. It counts its duplicates and remembers the last one.
    sealed class TestDrink : IDrink
    {
        public List<string> Ingredients { get; } = [];
        public Garnish Garnish { get; } = new("test");
        public int Duplicates { get; private set; }
        public TestDrink? LastDuplicate { get; private set; }

        public string Describe() => "test drink";

        public IDrink Duplicate()
        {
            Duplicates++;
            LastDuplicate = new TestDrink();
            return LastDuplicate;
        }
    }

    // One drink of each kind, already mixed and garnished.
    static IDrink[] Samples()
    {
        var cocktail = new Cocktail("Daiquiri");
        cocktail.Ingredients.AddRange(["rum", "lime", "sugar"]);
        cocktail.Garnish.Name = "lime wheel";

        var mocktail = new Mocktail("Nojito");
        mocktail.Ingredients.AddRange(["lime", "mint", "soda"]);
        mocktail.Garnish.Name = "mint sprig";

        return [cocktail, mocktail];
    }

    [Check("drinks-describe-themselves")]
    static void DrinksDescribeThemselves()
    {
        var plain = new Cocktail("Gimlet");
        plain.Ingredients.AddRange(["gin", "lime"]);
        var described = Samples().Select(d => d.Describe()).ToList();

        Expect.That(described[0] == "Daiquiri (cocktail): rum, lime, sugar; garnish: lime wheel", "wrongCocktail", new { actual = described[0] });
        Expect.That(described[1] == "Nojito (alcohol-free): lime, mint, soda; garnish: mint sprig", "wrongMocktail", new { actual = described[1] });
        Expect.That(plain.Describe() == "Gimlet (cocktail): gin, lime; garnish: none", "wrongNoGarnish", new { expected = "Gimlet (cocktail): gin, lime; garnish: none", actual = plain.Describe() });
    }

    [Check("duplicates-keep-their-kind")]
    static void DuplicatesKeepTheirKind()
    {
        foreach (var drink in Samples())
        {
            var type = drink.GetType().Name;
            var copy = drink.Duplicate();
            Expect.That(copy is not null && !ReferenceEquals(copy, drink), "sameObject", new { type });
            Expect.That(copy!.GetType() == drink.GetType(), "wrongKind", new { type, actual = copy.GetType().Name });
            Expect.That(copy.Describe() == drink.Describe(), "differentCopy", new { type, expected = drink.Describe(), actual = copy.Describe() });
        }
    }

    [Check("duplicates-are-independent")]
    static void DuplicatesAreIndependent()
    {
        foreach (var drink in Samples())
        {
            var type = drink.GetType().Name;
            var before = drink.Describe();
            var copy = drink.Duplicate();

            copy.Ingredients.Add("chilli");
            copy.Ingredients.RemoveAt(0);
            Expect.That(drink.Describe() == before, "sharedIngredients", new { type, actual = drink.Describe() });

            copy.Garnish.Name = "cherry";
            Expect.That(drink.Describe() == before, "sharedGarnish", new { type, actual = drink.Describe() });
        }
    }

    [Check("same-again-leaves-the-first-alone")]
    static void SameAgainLeavesTheFirstAlone()
    {
        foreach (var drink in Samples())
        {
            var type = drink.GetType().Name;
            var tab = new Tab();
            tab.Order(new Cocktail("Martini"));
            tab.Order(drink);
            var before = drink.Describe();

            var again = tab.SameAgain();
            Expect.That(drink.Describe() == before, "firstChanged", new { type, actual = drink.Describe() });
            Expect.That(again is not null && !ReferenceEquals(again, drink), "againSameObject", new { type });
            Expect.That(again!.GetType() == drink.GetType() && again.Describe() == before, "againWrong",
                new { type, expected = before, actual = again.Describe() });
            Expect.That(tab.Count == 3, "wrongCount", new { count = tab.Count });

            again.Ingredients.Add("ice");
            again.Garnish.Name = "olive";
            Expect.That(drink.Describe() == before, "adjustingChangedFirst", new { type, actual = drink.Describe() });
        }
    }

    [Check("same-again-needs-an-order")]
    static void SameAgainNeedsAnOrder()
    {
        string outcome;
        try
        {
            new Tab().SameAgain();
            outcome = "no exception";
        }
        catch (InvalidOperationException)
        {
            outcome = "InvalidOperationException";
        }
        catch (Exception e)
        {
            outcome = e.GetType().Name;
        }
        Expect.That(outcome == "InvalidOperationException", "emptyTabAccepted", new { expected = "InvalidOperationException", actual = outcome });
    }

    [Check("same-again-works-for-any-drink")]
    static void SameAgainWorksForAnyDrink()
    {
        var tab = new Tab();
        var drink = new TestDrink();
        tab.Order(drink);
        var again = tab.SameAgain();
        Expect.That(drink.Duplicates == 1 && ReferenceEquals(again, drink.LastDuplicate), "notTheDuplicate", new { count = drink.Duplicates });

        var third = tab.SameAgain();
        Expect.That(ReferenceEquals(third, drink.LastDuplicate?.LastDuplicate), "notTheLastDrink");
    }

    [Check("tab-names-no-kind-of-drink")]
    static void TabNamesNoKindOfDrink()
    {
        var classes = typeof(IDrink).Assembly.GetTypes()
            .Where(t => t.IsClass && typeof(IDrink).IsAssignableFrom(t) && t.DeclaringType != typeof(HouseDrinksChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "Tab"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "tabNamesDrinkClass", new { type = named });
        }
    }
}
