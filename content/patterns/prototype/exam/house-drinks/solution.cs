var tab = new Tab();
var negroni = new Cocktail("Negroni");
negroni.Ingredients.AddRange(["gin", "campari", "red vermouth"]);
negroni.Garnish.Name = "orange peel";
tab.Order(negroni);

var second = tab.SameAgain();
second.Ingredients.Add("soda");
second.Garnish.Name = "lemon peel";
Console.WriteLine(negroni.Describe());
Console.WriteLine(second.Describe());
Console.WriteLine($"{tab.Count} drinks");

// What sits on the rim of the glass. A drink holds it as a separate object.
public class Garnish(string name)
{
    public string Name { get; set; } = name;
}

// Every drink can pour an independent duplicate of itself. The tab only ever sees IDrink.
public interface IDrink
{
    List<string> Ingredients { get; }
    Garnish Garnish { get; }
    string Describe();
    IDrink Duplicate();
}

public class Cocktail : IDrink
{
    private readonly string name;

    public Cocktail(string name) => this.name = name;

    // A copy constructor: the same name, plus ingredients and a garnish of its own.
    private Cocktail(Cocktail other) : this(other.name)
    {
        Ingredients.AddRange(other.Ingredients);
        Garnish.Name = other.Garnish.Name;
    }

    public List<string> Ingredients { get; } = [];
    public Garnish Garnish { get; } = new("none");

    public string Describe() => $"{name} (cocktail): {string.Join(", ", Ingredients)}; garnish: {Garnish.Name}";

    public IDrink Duplicate() => new Cocktail(this);
}

public class Mocktail(string name) : IDrink
{
    public List<string> Ingredients { get; private set; } = [];
    public Garnish Garnish { get; private set; } = new("none");

    public string Describe() => $"{name} (alcohol-free): {string.Join(", ", Ingredients)}; garnish: {Garnish.Name}";

    // MemberwiseClone copies each field as it is, so the ingredients and the garnish are replaced with copies.
    public IDrink Duplicate()
    {
        var copy = (Mocktail)MemberwiseClone();
        copy.Ingredients = [.. Ingredients];
        copy.Garnish = new Garnish(Garnish.Name);
        return copy;
    }
}

// A guest's tab. "Same again" pours another of the last drink, which the guest may then adjust.
public class Tab
{
    private readonly List<IDrink> drinks = [];

    public int Count => drinks.Count;

    public void Order(IDrink drink) => drinks.Add(drink);

    public IDrink SameAgain()
    {
        if (drinks.Count == 0) throw new InvalidOperationException("Nothing has been ordered yet.");
        var drink = drinks[^1].Duplicate();
        drinks.Add(drink);
        return drink;
    }
}
