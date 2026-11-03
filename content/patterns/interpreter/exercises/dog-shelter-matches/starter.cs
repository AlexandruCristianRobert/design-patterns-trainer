foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Dog[] dogs =
        [
            new Dog("Biscuit", "beagle", 2, true),
            new Dog("Rex", "collie", 7, false),
            new Dog("Mila", "collie", 1, true),
            new Dog("Otto", "boxer", 4, true),
        ];

        // A family with a cat wants a young dog that is fine with cats.
        var family = new Wish("all", parts: [new Wish("younger-than", number: 3), new Wish("cat-friendly")]);
        // A farmer wants a collie, or any dog that is not a beagle and is at least 4 years old.
        var farmer = new Wish("any", parts:
        [
            new Wish("breed", word: "collie"),
            new Wish("all", parts: [new Wish("not", parts: [new Wish("breed", word: "beagle")]), new Wish("not", parts: [new Wish("younger-than", number: 4)])]),
        ]);

        var lines = new List<string>();
        foreach (var (who, wish) in new[] { ("family", family), ("farmer", farmer) })
        {
            var names = dogs.Where(d => Matcher.Fits(wish, d)).Select(d => d.Name).ToList();
            lines.Add($"{who}: {(names.Count == 0 ? "no dog" : string.Join(", ", names))}");
        }
        return lines;
    }
}

// One part of what an adopter wishes for. Its Kind says what it is, and "all", "any" and "not" hold other parts.
public class Wish(string kind, string word = "", int number = 0, Wish[]? parts = null)
{
    public string Kind => kind;
    public string Word => word;
    public int Number => number;
    public Wish[] Parts => parts ?? [];
}

// Works out whether a dog fits a wish. Every kind of wish is one case here.
public static class Matcher
{
    public static bool Fits(Wish wish, Dog dog) => wish.Kind switch
    {
        "breed" => dog.Breed == wish.Word,
        "younger-than" => dog.Age < wish.Number,
        "cat-friendly" => dog.GoodWithCats,
        "all" => wish.Parts.All(p => Fits(p, dog)),
        "any" => wish.Parts.Any(p => Fits(p, dog)),
        "not" => !Fits(wish.Parts[0], dog),
        _ => false,
    };
}

// A dog waiting at the shelter. Leave as is.
public class Dog(string name, string breed, int age, bool goodWithCats)
{
    public string Name => name;
    public string Breed => breed;
    public int Age => age;
    public bool GoodWithCats => goodWithCats;
}
