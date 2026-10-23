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
        // TODO: get one guide for this tour and number what it says at each exhibit: "1. ...", "2. ...".
        return [];
    }
}

public class FamilyTour : Tour
{
    protected override IGuide CreateGuide() => new StoryGuide();
}

public class ExpertTour : Tour
{
    // TODO: an expert tour is spoken by an ExpertGuide.
    protected override IGuide CreateGuide() => throw new NotImplementedException();
}
