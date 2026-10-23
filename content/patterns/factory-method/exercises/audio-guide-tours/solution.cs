List<string> exhibits = ["golden mask", "sun clock"];

Tour family = new FamilyTour();
foreach (var line in family.Play(exhibits))
    Console.WriteLine($"family: {line}");

Tour expert = new ExpertTour();
foreach (var line in expert.Play(exhibits))
    Console.WriteLine($"expert: {line}");

public interface IGuide
{
    // What the guide says at one exhibit.
    string Describe(string exhibit);
}

public class StoryGuide : IGuide
{
    public string Describe(string exhibit) => $"Here is the story of the {exhibit}.";
}

public class ExpertGuide : IGuide
{
    public string Describe(string exhibit) => $"The {exhibit}: date, maker and materials.";
}

public abstract class Tour
{
    // Each kind of tour decides which guide speaks. Leave this declaration as it is.
    protected abstract IGuide CreateGuide();

    public List<string> Play(List<string> exhibits)
    {
        var guide = CreateGuide();
        var lines = new List<string>();
        for (var i = 0; i < exhibits.Count; i++)
            lines.Add($"{i + 1}. {guide.Describe(exhibits[i])}");
        return lines;
    }
}

public class FamilyTour : Tour
{
    protected override IGuide CreateGuide() => new StoryGuide();
}

public class ExpertTour : Tour
{
    protected override IGuide CreateGuide() => new ExpertGuide();
}
