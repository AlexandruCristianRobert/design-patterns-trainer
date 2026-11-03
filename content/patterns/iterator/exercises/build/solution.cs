using System.Collections;

var machine = new SnackMachine(3, 4);
machine.Fill("B2", "crisps");
machine.Fill("A1", "water");
machine.Fill("C2", "toffee");
machine.Fill("A4", "gum");

foreach (var snack in machine)
    Console.WriteLine($"{snack.Slot} {snack.Name}");
Console.WriteLine($"column 2: {string.Join(", ", machine.Column(2).Select(s => s.Name))}");

// What a walk meets in one slot.
public record Snack(string Slot, string Name);

// A snack machine with lettered rows and numbered columns. It keeps its slots to itself.
public class SnackMachine(int rows, int columns) : IEnumerable<Snack>
{
    private readonly string?[,] slots = new string?[rows, columns];

    public void Fill(string slot, string name)
    {
        var (row, column) = Find(slot);
        slots[row, column] = name;
    }

    public void Take(string slot)
    {
        var (row, column) = Find(slot);
        slots[row, column] = null;
    }

    // Row by row, each row from column 1 up. It looks into a slot only when it gets there.
    public IEnumerator<Snack> GetEnumerator()
    {
        for (var row = 0; row < rows; row++)
            for (var column = 0; column < columns; column++)
                if (slots[row, column] is { } name)
                    yield return new Snack(Label(row, column), name);
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    // Down one column, from row A.
    public IEnumerable<Snack> Column(int column)
    {
        for (var row = 0; row < rows; row++)
            if (slots[row, column - 1] is { } name)
                yield return new Snack(Label(row, column - 1), name);
    }

    // "B3" is row 1, column 2, counted from 0.
    private static (int Row, int Column) Find(string slot) => (slot[0] - 'A', int.Parse(slot[1..]) - 1);

    private static string Label(int row, int column) => $"{(char)('A' + row)}{column + 1}";
}
