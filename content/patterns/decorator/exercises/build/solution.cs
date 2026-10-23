IAttack sword = new Weapon("sword", 10);
Show(sword);
Show(new Sharp(new Fiery(sword)));
Show(new Fiery(new Sharp(sword)));
Show(new Rusty(new Weapon("dagger", 4)));

static void Show(IAttack attack) => Console.WriteLine($"{attack.Describe()}: {attack.Damage()} damage");

public interface IAttack
{
    int Damage();
    string Describe();
}

public class Weapon(string name, int damage) : IAttack
{
    public int Damage() => damage;
    public string Describe() => name;
}

public class Fiery(IAttack attack) : IAttack
{
    public int Damage() => attack.Damage() + 5;
    public string Describe() => "fiery " + attack.Describe();
}

public class Sharp(IAttack attack) : IAttack
{
    public int Damage() => attack.Damage() * 2;
    public string Describe() => "sharp " + attack.Describe();
}

public class Rusty(IAttack attack) : IAttack
{
    public int Damage() => Math.Max(1, attack.Damage() - 4);
    public string Describe() => "rusty " + attack.Describe();
}
