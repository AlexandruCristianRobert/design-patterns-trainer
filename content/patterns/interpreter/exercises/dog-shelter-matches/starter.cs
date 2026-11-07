foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        Dog[] dogs =
        [
            new Dog("Biscuit", "beagle", true),
            new Dog("Rex", "collie", false),
            new Dog("Mila", "collie", true),
            new Dog("Otto", "boxer", true),
        ];

        // A family with a cat wants a dog that is fine with cats and is not a beagle.
        var family = new Wish("all", parts: [new Wish("cat-friendly"), new Wish("not", parts: [new Wish("breed", word: "beagle")])]);
        // A farmer with no cats wants a collie that is not good with cats.
        var farmer = new Wish("all", parts: [new Wish("breed", word: "collie"), new Wish("not", parts: [new Wish("cat-friendly")])]);

        var lines = new List<string>();
        foreach (var (who, wish) in new[] { ("family", family), ("farmer", farmer) })
        {
            var names = dogs.Where(d => Matcher.Fits(wish, d)).Select(d => d.Name);
            lines.Add($"{who}: {string.Join(", ", names)}");
        }
        return lines;
    }
}

// One part of what an adopter wishes for. Its Kind says what it is, and "all" and "not" hold other parts.
public class Wish(string kind, string word = "", Wish[]? parts = null)
{
    public string Kind => kind;
    public string Word => word;
    public Wish[] Parts => parts ?? [];
}

// Works out whether a dog fits a wish. Every kind of wish is one case here.
public static class Matcher
{
    public static bool Fits(Wish wish, Dog dog) => wish.Kind switch
    {
        "breed" => dog.Breed == wish.Word,
        "cat-friendly" => dog.GoodWithCats,
        "all" => wish.Parts.All(p => Fits(p, dog)),
        "not" => !Fits(wish.Parts[0], dog),
        _ => false,
    };
}

// A dog waiting at the shelter. Leave as is.
public class Dog(string name, string breed, bool goodWithCats)
{
    public string Name => name;
    public string Breed => breed;
    public bool GoodWithCats => goodWithCats;
}
