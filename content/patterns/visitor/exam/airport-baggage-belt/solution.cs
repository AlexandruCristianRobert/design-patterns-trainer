var belt = new Belt();
belt.Load(new Suitcase("BA1", 18));
belt.Load(new GolfBag("G7"));
belt.Load(new PetCrate("P2", "dog"));
belt.Load(new Suitcase("BA2", 26));
Console.WriteLine($"screening: {belt.ScreeningMinutes()} minutes");
foreach (var label in belt.Labels())
    Console.WriteLine(label);

// A bag hands itself to a check, which gives its answer for that bag.
public interface IBag
{
    T PassThrough<T>(IBagCheck<T> check);
}

public interface IBagCheck<T>
{
    T ForSuitcase(Suitcase suitcase);
    T ForGolfBag(GolfBag bag);
    T ForPetCrate(PetCrate crate);
}

public class Suitcase(string tag, int kg) : IBag
{
    public string Tag { get; } = tag;
    public int Kg { get; } = kg;

    public T PassThrough<T>(IBagCheck<T> check) => check.ForSuitcase(this);
}

public class GolfBag(string tag) : IBag
{
    public string Tag { get; } = tag;

    public T PassThrough<T>(IBagCheck<T> check) => check.ForGolfBag(this);
}

public class PetCrate(string tag, string animal) : IBag
{
    public string Tag { get; } = tag;
    public string Animal { get; } = animal;

    public T PassThrough<T>(IBagCheck<T> check) => check.ForPetCrate(this);
}

public class ScreeningTime : IBagCheck<int>
{
    public int ForSuitcase(Suitcase suitcase) => suitcase.Kg > 23 ? 2 : 1;
    public int ForGolfBag(GolfBag bag) => 3;
    public int ForPetCrate(PetCrate crate) => 5;
}

public class HandlingLabels : IBagCheck<string>
{
    public string ForSuitcase(Suitcase suitcase) => $"{suitcase.Tag}: {(suitcase.Kg > 23 ? "heavy" : "standard")}";
    public string ForGolfBag(GolfBag bag) => $"{bag.Tag}: oversize";
    public string ForPetCrate(PetCrate crate) => $"{crate.Tag}: live animal, {crate.Animal}";
}

public class Belt
{
    private readonly List<IBag> bags = new();

    public void Load(IBag bag) => bags.Add(bag);

    public int ScreeningMinutes() => bags.Sum(bag => bag.PassThrough(new ScreeningTime()));

    public List<string> Labels() => bags.Select(bag => bag.PassThrough(new HandlingLabels())).ToList();
}
