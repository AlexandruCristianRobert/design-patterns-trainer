// Each rule of the language is a class. A sentence is a tree of rules, and the tree answers IsTrue.
var water = new Both(new SensorIs("soil-dry"), new Not(new SensorIs("raining")));
var vent = new Both(new SensorIs("hot"), new SensorIs("sunny"));

var days = new List<(string Name, Readings Readings)>
{
    ("morning", new Readings("soil-dry", "sunny")),
    ("noon", new Readings("soil-dry", "sunny", "hot")),
    ("storm", new Readings("soil-dry", "raining", "hot")),
};

foreach (var (name, readings) in days)
    Console.WriteLine($"{name}: water {Answer(water.IsTrue(readings))}, vent {Answer(vent.IsTrue(readings))}");

static string Answer(bool yes) => yes ? "yes" : "no";

public interface IRule
{
    bool IsTrue(Readings readings);
}

public class SensorIs(string sensor) : IRule
{
    public bool IsTrue(Readings readings) => readings.Has(sensor);
}

public class Both(IRule left, IRule right) : IRule
{
    public bool IsTrue(Readings readings) => left.IsTrue(readings) && right.IsTrue(readings);
}

public class Either(IRule left, IRule right) : IRule
{
    public bool IsTrue(Readings readings) => left.IsTrue(readings) || right.IsTrue(readings);
}

public class Not(IRule rule) : IRule
{
    public bool IsTrue(Readings readings) => !rule.IsTrue(readings);
}

public class Readings(params string[] active)
{
    public bool Has(string sensor) => active.Contains(sensor);
}
