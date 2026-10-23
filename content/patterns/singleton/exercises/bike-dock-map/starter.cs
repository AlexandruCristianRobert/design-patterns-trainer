// Build the bike-share dock map described in the scenario.
// The Contract panel lists the types and members the Checks will use.

// The file with every dock and its bikes. Reading it is slow. Leave this class as it is.
public static class DockFile
{
    public static int Reads { get; private set; }

    public static Dictionary<string, int> Read()
    {
        Reads++;
        return new() { ["Harbour"] = 6, ["Old Town"] = 2, ["Station"] = 0 };
    }
}
