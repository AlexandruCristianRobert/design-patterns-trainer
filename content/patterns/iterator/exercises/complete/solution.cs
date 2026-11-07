using System.Collections;

var bank = new LockerBank(6);
bank.Store(5, new Bag("Omar", 1));
bank.Store(2, new Bag("Maya", 3));
bank.Store(3, new Bag("Lena", 2));
bank.Collect(3);
bank.Store(6, new Bag("Ivo", 1));

foreach (var bag in bank)
    Console.WriteLine($"{bag.Owner}, {bag.Days} day(s)");
Console.WriteLine($"owed: {LockerFees.Owed(bank)}");

// One bag left in a locker, and the number of days it has been there. Leave as is.
public record Bag(string Owner, int Days);

// A bank of left-luggage lockers at a station, numbered from 1. Some lockers are empty.
// It keeps its lockers to itself: the only way to see the bags is to walk over them.
public class LockerBank : IEnumerable<Bag>
{
    private readonly Bag?[] lockers;

    public LockerBank(int size) => lockers = new Bag?[size];

    public void Store(int number, Bag bag) => lockers[number - 1] = bag;
    public void Collect(int number) => lockers[number - 1] = null;

    // Every walk gets a new walker, so two walks never share a position.
    public IEnumerator<Bag> GetEnumerator() => new LockerWalker(lockers);
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

// Walks the lockers from number 1 up, and stops only at lockers that hold a bag.
public class LockerWalker(Bag?[] lockers) : IEnumerator<Bag>
{
    // The index of the locker the walker is at. -1 means it has not started yet.
    private int at = -1;

    public Bag Current { get; private set; } = null!;
    object IEnumerator.Current => Current;

    public bool MoveNext()
    {
        while (++at < lockers.Length)
        {
            if (lockers[at] is { } bag)
            {
                Current = bag;
                return true;
            }
        }
        return false;
    }

    public void Reset() => at = -1;
    public void Dispose() { }
}

// What the station charges when the bags are collected: 6 for every day of every bag.
public static class LockerFees
{
    public static int Owed(LockerBank bank)
    {
        var owed = 0;
        foreach (var bag in bank)
            owed += 6 * bag.Days;
        return owed;
    }
}
