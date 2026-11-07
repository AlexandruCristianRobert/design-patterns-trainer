// The formula MR + 2 - 1 is made once, as a tree; it then works out a value for whatever is in memory.
Formula formula = new Subtract(new Add(new Recall(), new Number(2)), new Number(1));

foreach (var stored in new[] { 3, 10, -1 })
    Console.WriteLine($"memory {stored}: {formula.Value(new Memory(stored))}");

// What is in the calculator's memory key.
public class Memory(int stored)
{
    public int Stored => stored;
}

// Every key of a formula works out its own value from what is in memory.
public abstract class Formula
{
    public abstract int Value(Memory memory);
}

public class Number(int value) : Formula
{
    public override int Value(Memory memory) => value;
}

public class Recall : Formula
{
    public override int Value(Memory memory) => memory.Stored;
}

public class Add(Formula left, Formula right) : Formula
{
    public override int Value(Memory memory) => left.Value(memory) + right.Value(memory);
}

public class Subtract(Formula left, Formula right) : Formula
{
    public override int Value(Memory memory) => left.Value(memory) - right.Value(memory);
}
