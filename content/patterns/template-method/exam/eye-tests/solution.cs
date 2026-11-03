foreach (var test in new EyeTest[] { new AdultEyeTest(), new ChildEyeTest(), new DriverEyeTest() })
{
    foreach (var line in test.Run("Noor"))
        Console.WriteLine(line);
    Console.WriteLine();
}

// Every eye test at the optician's runs in the same steps, in the same order. Run is not virtual, so no kind of test can change it.
public abstract class EyeTest
{
    public List<string> Run(string patient)
    {
        var lines = new List<string> { $"{patient}: ask about the eyes", $"read the {Chart()}" };
        var pressure = PressureTest();
        if (pressure != "")
            lines.Add(pressure);
        lines.Add("look at the back of the eyes");
        lines.Add(Outcome());
        return lines;
    }

    // Each kind of test fills these in.
    protected abstract string Chart();
    protected abstract string Outcome();

    // A kind of test may leave the pressure test out by returning an empty line.
    protected virtual string PressureTest() => "test the eye pressure with a puff of air";
}

public class AdultEyeTest : EyeTest
{
    protected override string Chart() => "letter chart";
    protected override string Outcome() => "write the glasses prescription";
}

public class ChildEyeTest : EyeTest
{
    protected override string Chart() => "picture chart";
    protected override string Outcome() => "write a note for the parents";
    protected override string PressureTest() => "";
}

public class DriverEyeTest : EyeTest
{
    protected override string Chart() => "number plate at 20 metres";
    protected override string Outcome() => "sign the driving form";
}
