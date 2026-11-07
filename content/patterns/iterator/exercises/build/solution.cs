using System.Collections;

var machine = new SnackMachine(6);
machine.Fill(5, "toffee");
machine.Fill(1, "water");
machine.Fill(4, "gum");
machine.Fill(2, "crisps");
machine.Take(2);

foreach (var snack in machine)
    Console.WriteLine($"{snack.Slot} {snack.Name}");

// What a walk meets in one slot.
public record Snack(int Slot, string Name);

// A snack machine with slots numbered from 1. It keeps its slots to itself.
public class SnackMachine(int size) : IEnumerable<Snack>
{
    // One spare place, so slot 1 is slots[1] and index 0 is never used. null means empty.
    private readonly string?[] slots = new string?[size + 1];

    public void Fill(int slot, string name) => slots[slot] = name;
    public void Take(int slot) => slots[slot] = null;

    // From slot 1 up, only the slots that hold a snack. Every call starts a new walk.
    public IEnumerator<Snack> GetEnumerator()
    {
        for (var slot = 1; slot <= size; slot++)
            if (slots[slot] is { } name)
                yield return new Snack(slot, name);
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}
