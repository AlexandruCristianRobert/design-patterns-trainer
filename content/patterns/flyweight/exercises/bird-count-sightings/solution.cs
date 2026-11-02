var guide = new SpeciesGuide();
var survey = new Survey(guide);
survey.Record("robin", "B4", 3);
survey.Record("wren", "C1", 1);
survey.Record("robin", "D2", 2);

Console.WriteLine(survey.Report(0));
Console.WriteLine(survey.Report(1));
Console.WriteLine($"Robins counted: {survey.Total("robin")}");
Console.WriteLine($"Species created: {guide.Created}");

// What every sighting of one species has in common. It never changes, so all those sightings share it.
public sealed record Species(string Name, string Latin);

// Hands out one Species per name, and creates it only the first time that name is asked for.
public class SpeciesGuide
{
    private Species? robin, blackbird, wren;

    public int Created { get; private set; }

    public Species Get(string name) => name switch
    {
        "robin" => robin ??= Make("robin", "Erithacus rubecula"),
        "blackbird" => blackbird ??= Make("blackbird", "Turdus merula"),
        "wren" => wren ??= Make("wren", "Troglodytes troglodytes"),
        _ => throw new ArgumentException($"No species called {name}."),
    };

    private Species Make(string name, string latin)
    {
        Created++;
        return new Species(name, latin);
    }
}

// One sighting: where it was, how many birds, and a reference to the shared species.
public readonly record struct Sighting(string Square, int Birds, Species Species);

public class Survey(SpeciesGuide guide)
{
    private readonly List<Sighting> sightings = [];

    public void Record(string species, string square, int birds) => sightings.Add(new Sighting(square, birds, guide.Get(species)));

    public Species SpeciesOf(int index) => sightings[index].Species;

    public string Report(int index)
    {
        var s = sightings[index];
        return $"{s.Square}: {s.Species.Name} ({s.Species.Latin}), count {s.Birds}";
    }

    public int Total(string species) => sightings.Where(s => s.Species.Name == species).Sum(s => s.Birds);
}
