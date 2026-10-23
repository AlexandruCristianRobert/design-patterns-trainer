Level forest = new ForestLevel();
Console.WriteLine($"Forest: {forest.SpawnWave(2)}");

Level cave = new CaveLevel();
Console.WriteLine($"Cave: {cave.SpawnWave(2)}");

public interface IEnemy
{
    string Name { get; }
}

public class Wolf : IEnemy
{
    public string Name => "wolf";
}

public class Bat : IEnemy
{
    public string Name => "bat";
}

public abstract class Level
{
    // The factory method: each kind of level decides which enemy to make.
    protected abstract IEnemy CreateEnemy();

    // The operation the base class owns. It never names a concrete enemy.
    public string SpawnWave(int size)
    {
        var wave = new List<string>();
        for (var i = 1; i <= size; i++)
            wave.Add($"{CreateEnemy().Name} {i}");
        return string.Join(", ", wave);
    }
}

public class ForestLevel : Level
{
    protected override IEnemy CreateEnemy() => new Wolf();
}

public class CaveLevel : Level
{
    protected override IEnemy CreateEnemy() => new Bat();
}
