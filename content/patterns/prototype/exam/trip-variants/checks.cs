using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class TripVariantsChecks
{
    // A kind of trip the program has never seen. It counts its duplicates and remembers the last one.
    sealed class TestTrip : ITrip
    {
        public string Name { get; set; } = "Test trip";
        public List<string> Stops { get; } = [];
        public Budget Budget { get; } = new(1);
        public int Duplicates { get; private set; }
        public TestTrip? LastDuplicate { get; private set; }

        public string Summary() => $"{Name}: test";

        public ITrip Duplicate()
        {
            Duplicates++;
            LastDuplicate = new TestTrip { Name = Name };
            return LastDuplicate;
        }
    }

    // One trip of each kind, already planned with stops.
    static ITrip[] Samples()
    {
        var road = new RoadTrip("Coast run", "hatchback", 700);
        road.Stops.AddRange(["Split", "Makarska", "Dubrovnik"]);

        var city = new CityBreak("Lisbon weekend", "Casa Azul", 600);
        city.Stops.AddRange(["Alfama", "Belem"]);

        return [road, city];
    }

    [Check("trips-sum-themselves-up")]
    static void TripsSumThemselvesUp()
    {
        var road = new RoadTrip("Coast run", "hatchback", 700);
        road.Stops.AddRange(["Split", "Makarska", "Dubrovnik"]);
        var city = new CityBreak("Lisbon weekend", "Casa Azul", 600);
        city.Stops.AddRange(["Alfama", "Belem"]);
        var empty = new CityBreak("Rome", "Hotel Sole", 400);

        Expect.That(road.Summary() == "Coast run: road trip by hatchback, 700 EUR: Split > Makarska > Dubrovnik", "wrongRoad", new { actual = road.Summary() });
        Expect.That(city.Summary() == "Lisbon weekend: city break at Casa Azul, 600 EUR: Alfama > Belem", "wrongCity", new { actual = city.Summary() });
        Expect.That(empty.Summary() == "Rome: city break at Hotel Sole, 400 EUR: no stops yet", "wrongEmpty", new { actual = empty.Summary() });
    }

    [Check("duplicates-keep-their-kind")]
    static void DuplicatesKeepTheirKind()
    {
        foreach (var trip in Samples())
        {
            var type = trip.GetType().Name;
            var copy = trip.Duplicate();
            Expect.That(copy is not null && !ReferenceEquals(copy, trip), "sameObject", new { type });
            Expect.That(copy!.GetType() == trip.GetType(), "wrongKind", new { type, actual = copy.GetType().Name });
            Expect.That(copy.Summary() == trip.Summary(), "differentCopy", new { type, expected = trip.Summary(), actual = copy.Summary() });
        }
    }

    [Check("duplicates-are-independent")]
    static void DuplicatesAreIndependent()
    {
        foreach (var trip in Samples())
        {
            var type = trip.GetType().Name;
            var before = trip.Summary();
            var copy = trip.Duplicate();

            copy.Stops.Add("Zagreb");
            copy.Stops.RemoveAt(0);
            Expect.That(trip.Summary() == before, "sharedStops", new { type, actual = trip.Summary() });

            copy.Budget.Euros = 50;
            Expect.That(trip.Summary() == before, "sharedBudget", new { type, actual = trip.Summary() });
        }
    }

    [Check("save-as-new-keeps-the-original")]
    static void SaveAsNewKeepsTheOriginal()
    {
        foreach (var trip in Samples())
        {
            var type = trip.GetType().Name;
            var list = new TripList();
            list.Add(trip);
            var before = trip.Summary();
            var saved = list.SaveAsNew(trip, "Plan B");

            Expect.That(trip.Summary() == before, "originalChanged", new { type, actual = trip.Summary() });
            Expect.That(saved is not null && !ReferenceEquals(saved, trip), "savedSameObject", new { type });
            Expect.That(saved!.GetType() == trip.GetType(), "savedWrongKind", new { type, actual = saved.GetType().Name });
            Expect.That(saved.Name == "Plan B" && saved.Stops.SequenceEqual(trip.Stops) && saved.Budget.Euros == trip.Budget.Euros,
                "savedWrong", new { type, actual = saved.Summary() });
            Expect.That(list.Count == 2, "wrongCount", new { count = list.Count });
        }
    }

    [Check("save-as-new-works-for-any-trip")]
    static void SaveAsNewWorksForAnyTrip()
    {
        var list = new TripList();
        var trip = new TestTrip();
        list.Add(trip);
        var saved = list.SaveAsNew(trip, "Renamed");

        Expect.That(trip.Duplicates == 1 && ReferenceEquals(saved, trip.LastDuplicate), "notTheDuplicate", new { count = trip.Duplicates });
        Expect.That(trip.Name == "Test trip", "testOriginalRenamed", new { actual = trip.Name });
        Expect.That(saved.Name == "Renamed", "testNotRenamed", new { actual = saved.Name });
        Expect.That(list.Count == 2, "wrongCount", new { count = list.Count });
    }

    [Check("list-names-no-kind-of-trip")]
    static void ListNamesNoKindOfTrip()
    {
        var classes = typeof(ITrip).Assembly.GetTypes()
            .Where(t => t.IsClass && typeof(ITrip).IsAssignableFrom(t) && t.DeclaringType != typeof(TripVariantsChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "TripList"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "listNamesTripClass", new { type = named });
        }
    }
}
