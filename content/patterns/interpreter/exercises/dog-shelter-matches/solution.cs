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
        DogWish family = new AllOf(new CatFriendly(), new Not(new IsBreed("beagle")));
        // A farmer with no cats wants a collie that is not good with cats.
        DogWish farmer = new AllOf(new IsBreed("collie"), new Not(new CatFriendly()));

        var lines = new List<string>();
        foreach (var (who, wish) in new[] { ("family", family), ("farmer", farmer) })
        {
            var names = dogs.Where(wish.Fits).Select(d => d.Name);
            lines.Add($"{who}: {string.Join(", ", names)}");
        }
        return lines;
    }
}

// Every kind of wish is a class that works out for itself whether a dog fits it.
public interface DogWish
{
    bool Fits(Dog dog);
}

public class IsBreed(string breed) : DogWish
{
    public bool Fits(Dog dog) => dog.Breed == breed;
}

public class CatFriendly : DogWish
{
    public bool Fits(Dog dog) => dog.GoodWithCats;
}

public class AllOf(DogWish first, DogWish second) : DogWish
{
    public bool Fits(Dog dog) => first.Fits(dog) && second.Fits(dog);
}

public class Not(DogWish wish) : DogWish
{
    public bool Fits(Dog dog) => !wish.Fits(dog);
}

// A dog waiting at the shelter. Leave as is.
public class Dog(string name, string breed, bool goodWithCats)
{
    public string Name => name;
    public string Breed => breed;
    public bool GoodWithCats => goodWithCats;
}
