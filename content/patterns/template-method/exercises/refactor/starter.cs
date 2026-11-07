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

// Three copies of the same yearly check-up. Only two steps differ, and dogs get one step more.
public class CatCheckUp
{
    public List<string> Run(string pet)
    {
        var lines = new List<string>();
        lines.Add($"weigh {pet}");
        lines.Add("listen to the heart and check the teeth");
        lines.Add("vaccinate against cat flu");
        lines.Add("book the next check-up in a year");
        return lines;
    }
}

public class DogCheckUp
{
    public List<string> Run(string pet)
    {
        var lines = new List<string>();
        lines.Add($"weigh {pet}");
        lines.Add("check the hips and the teeth");
        lines.Add("vaccinate against kennel cough");
        lines.Add("trim the claws");
        lines.Add("book the next check-up in a year");
        return lines;
    }
}

public class RabbitCheckUp
{
    public List<string> Run(string pet)
    {
        var lines = new List<string>();
        lines.Add($"weigh {pet}");
        lines.Add("check the teeth and the ears");
        lines.Add("vaccinate against myxomatosis");
        lines.Add("book the next check-up in a year");
        return lines;
    }
}
