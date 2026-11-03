foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var lines = new List<string>();
        lines.AddRange(new CatCheckUp().Run("Tiger", 4));
        lines.AddRange(new DogCheckUp().Run("Bella", 11));
        lines.AddRange(new RabbitCheckUp().Run("Clover", 2));
        return lines;
    }
}

// Three copies of the same yearly check-up. Only two steps differ, and dogs get one step more.
public class CatCheckUp
{
    public List<string> Run(string pet, int age)
    {
        var lines = new List<string>();
        lines.Add($"{pet}, {age} years: weigh");
        lines.Add("listen to the heart and check the teeth");
        lines.Add("vaccinate against cat flu");
        if (age >= 10)
            lines.Add("take a blood test for older pets");
        lines.Add("book the next check-up in a year");
        return lines;
    }
}

public class DogCheckUp
{
    public List<string> Run(string pet, int age)
    {
        var lines = new List<string>();
        lines.Add($"{pet}, {age} years: weigh");
        lines.Add("check the hips and the teeth");
        lines.Add("vaccinate against kennel cough");
        if (age >= 10)
            lines.Add("take a blood test for older pets");
        lines.Add("trim the claws");
        lines.Add("book the next check-up in a year");
        return lines;
    }
}

public class RabbitCheckUp
{
    public List<string> Run(string pet, int age)
    {
        var lines = new List<string>();
        lines.Add($"{pet}, {age} years: weigh");
        lines.Add("check the teeth and the ears");
        lines.Add("vaccinate against myxomatosis");
        if (age >= 10)
            lines.Add("take a blood test for older pets");
        lines.Add("book the next check-up in a year");
        return lines;
    }
}
