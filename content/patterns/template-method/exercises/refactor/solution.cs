foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var lines = new List<string>();
        lines.AddRange(new CatCheckUp().Run("Tiger"));
        lines.AddRange(new DogCheckUp().Run("Bella"));
        lines.AddRange(new RabbitCheckUp().Run("Clover"));
        return lines;
    }
}

// The yearly check-up, written once. Run is not virtual, so no kind of check-up can change the order.
public abstract class CheckUp
{
    public List<string> Run(string pet)
    {
        var lines = new List<string> { $"weigh {pet}", Examine(), Vaccinate() };
        var extra = Extra();
        if (extra != "")
            lines.Add(extra);
        lines.Add("book the next check-up in a year");
        return lines;
    }

    // Each kind of check-up fills these in.
    protected abstract string Examine();
    protected abstract string Vaccinate();

    // An extra step a kind of check-up may add. By default there is none.
    protected virtual string Extra() => "";
}

public class CatCheckUp : CheckUp
{
    protected override string Examine() => "listen to the heart and check the teeth";
    protected override string Vaccinate() => "vaccinate against cat flu";
}

public class DogCheckUp : CheckUp
{
    protected override string Examine() => "check the hips and the teeth";
    protected override string Vaccinate() => "vaccinate against kennel cough";
    protected override string Extra() => "trim the claws";
}

public class RabbitCheckUp : CheckUp
{
    protected override string Examine() => "check the teeth and the ears";
    protected override string Vaccinate() => "vaccinate against myxomatosis";
}
