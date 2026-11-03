var floor = new ShopFloor([new FishTank(12), new Hamster("Nibbles"), new Parrot("Polly", true)]);
Console.WriteLine($"food this week: {floor.FoodCost()} EUR");
foreach (var card in floor.CareCards())
    Console.WriteLine(card);

public interface IPet
{
    void ShowTo(IPetChart chart);
}

// One method for each kind of pet. Each chart keeps its own result.
public interface IPetChart
{
    void FishTank(FishTank tank);
    void Hamster(Hamster hamster);
    void Parrot(Parrot parrot);
}

public class FishTank(int fish) : IPet
{
    public int Fish { get; } = fish;

    public void ShowTo(IPetChart chart) => chart.FishTank(this);
}

public class Hamster(string name) : IPet
{
    public string Name { get; } = name;

    public void ShowTo(IPetChart chart) => chart.Hamster(this);
}

public class Parrot(string name, bool talks) : IPet
{
    public string Name { get; } = name;
    public bool Talks { get; } = talks;

    public void ShowTo(IPetChart chart) => chart.Parrot(this);
}

public class WeeklyFood : IPetChart
{
    public int Euros { get; private set; }

    public void FishTank(FishTank tank) => Euros += (tank.Fish + 4) / 5;
    public void Hamster(Hamster hamster) => Euros += 3;
    public void Parrot(Parrot parrot) => Euros += 6;
}

public class CareCardWriter : IPetChart
{
    public List<string> Cards { get; } = new();

    public void FishTank(FishTank tank) => Cards.Add($"tank of {tank.Fish} fish: feed once a day");
    public void Hamster(Hamster hamster) => Cards.Add($"{hamster.Name}: fresh hay every morning");
    public void Parrot(Parrot parrot) => Cards.Add(parrot.Talks ? $"{parrot.Name}: talks, cover the cage at night" : $"{parrot.Name}: cover the cage at night");
}

public class ShopFloor(List<IPet> pets)
{
    public int FoodCost()
    {
        var food = new WeeklyFood();
        foreach (var pet in pets) pet.ShowTo(food);
        return food.Euros;
    }

    public List<string> CareCards()
    {
        var writer = new CareCardWriter();
        foreach (var pet in pets) pet.ShowTo(writer);
        return writer.Cards;
    }
}
