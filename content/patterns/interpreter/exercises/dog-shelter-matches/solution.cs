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
        var family = new AllOf(new YoungerThan(3), new CatFriendly());
        // A farmer wants a collie, or any dog that is not a beagle and is at least 4 years old.
        var farmer = new AnyOf(new IsBreed("collie"), new AllOf(new Not(new IsBreed("beagle")), new Not(new YoungerThan(4))));

        var lines = new List<string>();
        foreach (var (who, wish) in new (string, DogWish)[] { ("family", family), ("farmer", farmer) })
        {
            var names = dogs.Where(wish.Fits).Select(d => d.Name).ToList();
            lines.Add($"{who}: {(names.Count == 0 ? "no dog" : string.Join(", ", names))}");
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

public class YoungerThan(int years) : DogWish
{
    public bool Fits(Dog dog) => dog.Age < years;
}

public class CatFriendly : DogWish
{
    public bool Fits(Dog dog) => dog.GoodWithCats;
}

public class AllOf(DogWish first, DogWish second) : DogWish
{
    public bool Fits(Dog dog) => first.Fits(dog) && second.Fits(dog);
}

public class AnyOf(DogWish first, DogWish second) : DogWish
{
    public bool Fits(Dog dog) => first.Fits(dog) || second.Fits(dog);
}

public class Not(DogWish wish) : DogWish
{
    public bool Fits(Dog dog) => !wish.Fits(dog);
}

// A dog waiting at the shelter. Leave as is.
public class Dog(string name, string breed, int age, bool goodWithCats)
{
    public string Name => name;
    public string Breed => breed;
    public int Age => age;
    public bool GoodWithCats => goodWithCats;
}
