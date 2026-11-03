using System.Collections;

var roof = new SolarRoof(3, 3);
roof.Mount(1, 1, "P1");
roof.Mount(1, 2, "P2");
roof.Mount(1, 3, "P3");
roof.Mount(2, 1, "P4");
roof.Mount(2, 3, "P6");
roof.Mount(3, 2, "P8");
Console.WriteLine(CleaningRobot.Plan(roof));

// The panels on a roof, in rows and columns counted from 1. A place can be empty, such as round a chimney.
public class SolarRoof(int rows, int columns) : IEnumerable<string>
{
    private readonly string?[,] places = new string?[rows, columns];

    public void Mount(int row, int column, string panel) => places[row - 1, column - 1] = panel;
    public void Remove(int row, int column) => places[row - 1, column - 1] = null;

    // The robot's path: row 1 left to right, row 2 right to left, and so on. Empty places are stepped over.
    public IEnumerator<string> GetEnumerator()
    {
        for (var row = 0; row < rows; row++)
            for (var step = 0; step < columns; step++)
            {
                var column = row % 2 == 0 ? step : columns - 1 - step;
                if (places[row, column] is { } panel)
                    yield return panel;
            }
    }

    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

public static class CleaningRobot
{
    public static string Plan(SolarRoof roof)
    {
        var path = string.Join(" > ", roof);
        return path == "" ? "nothing to clean" : path;
    }
}
