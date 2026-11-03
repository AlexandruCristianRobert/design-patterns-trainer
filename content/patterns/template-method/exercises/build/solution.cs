foreach (var hive in new HiveInspection[] { new LangstrothHive(), new TopBarHive(), new WarreHive() })
{
    foreach (var line in hive.Inspect(16))
        Console.WriteLine(line);
    Console.WriteLine();
}

// Every hive is inspected in the same steps, in the same order. Inspect is not virtual, so no kind of hive can change it.
public abstract class HiveInspection
{
    public List<string> Inspect(int temperature)
    {
        if (temperature < MinimumTemperature)
            return [$"too cold at {temperature} degrees: inspect another day"];

        var lines = new List<string> { "smoke the entrance", OpenUp(), CheckComb(), "look for the queen and her eggs" };
        var feed = Feed();
        if (feed != "")
            lines.Add(feed);
        lines.Add("close the hive and write the notes");
        return lines;
    }

    // Each kind of hive fills these in.
    protected abstract int MinimumTemperature { get; }
    protected abstract string OpenUp();
    protected abstract string CheckComb();

    // A step a kind of hive may add. By default there is no feeding.
    protected virtual string Feed() => "";
}

public class LangstrothHive : HiveInspection
{
    protected override int MinimumTemperature => 14;
    protected override string OpenUp() => "lift the lid";
    protected override string CheckComb() => "check 10 frames";
}

public class TopBarHive : HiveInspection
{
    protected override int MinimumTemperature => 17;
    protected override string OpenUp() => "lift the roof";
    protected override string CheckComb() => "check the bars one by one";
    protected override string Feed() => "top up the sugar syrup";
}

public class WarreHive : HiveInspection
{
    protected override int MinimumTemperature => 15;
    protected override string OpenUp() => "lift the quilt box";
    protected override string CheckComb() => "check the lowest box only";
}
