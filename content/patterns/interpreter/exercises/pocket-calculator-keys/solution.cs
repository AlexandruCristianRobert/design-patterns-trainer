// The keys are read once, into a tree; the tree then works out a value for whatever is in memory.
var formula = KeyReader.Read("M1 2 + M2 *");

var memory = new Memory();
foreach (var (m1, m2) in new[] { (3, 4), (10, 2), (-1, 5) })
{
    memory.Store("M1", m1);
    memory.Store("M2", m2);
    Console.WriteLine($"M1 = {m1}, M2 = {m2}: {formula.Value(memory)}");
}

// The calculator's memory keys and what is stored in them.
public class Memory
{
    private readonly Dictionary<string, int> stored = [];

    public void Store(string key, int value) => stored[key] = value;
    public int Get(string key) => stored.GetValueOrDefault(key);
}

// Every part of a formula works out its own value from what is in memory.
public abstract class Formula
{
    public abstract int Value(Memory memory);
}

public class Number(int value) : Formula
{
    public override int Value(Memory memory) => value;
}

public class Recall(string key) : Formula
{
    public override int Value(Memory memory) => memory.Get(key);
}

public class Add(Formula left, Formula right) : Formula
{
    public override int Value(Memory memory) => left.Value(memory) + right.Value(memory);
}

public class Subtract(Formula left, Formula right) : Formula
{
    public override int Value(Memory memory) => left.Value(memory) - right.Value(memory);
}

public class Multiply(Formula left, Formula right) : Formula
{
    public override int Value(Memory memory) => left.Value(memory) * right.Value(memory);
}

// Turns the keys pressed, such as "M1 2 + 3 *", into a tree of formulas. It works nothing out itself.
public static class KeyReader
{
    public static Formula Read(string keys)
    {
        var stack = new Stack<Formula>();
        foreach (var key in keys.Split(' '))
        {
            if (key is "+" or "-" or "*")
            {
                var right = stack.Pop();
                var left = stack.Pop();
                stack.Push(key switch
                {
                    "+" => new Add(left, right),
                    "-" => new Subtract(left, right),
                    _ => new Multiply(left, right),
                });
            }
            else if (key.StartsWith('M')) stack.Push(new Recall(key));
            else stack.Push(new Number(int.Parse(key)));
        }
        return stack.Pop();
    }
}
