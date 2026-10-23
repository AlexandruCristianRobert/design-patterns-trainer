var probe = new Probe([38, 41, 120, 44, 0, 40]);
IMoistureSensor reading = new Smoothed(new Clamp(new Offset(probe, 2)));
for (var i = 1; i <= 6; i++)
    Console.WriteLine($"reading {i}: {reading.Read()}%");

public interface IMoistureSensor
{
    // Soil moisture in percent.
    int Read();
}

// The probe in the soil. It gives its readings in turn and then keeps repeating the last one.
public class Probe(List<int> readings) : IMoistureSensor
{
    private int _next;

    public int Read() => readings[Math.Min(_next++, readings.Count - 1)];
}

public class Offset(IMoistureSensor sensor, int amount) : IMoistureSensor
{
    public int Read() => sensor.Read() + amount;
}

public class Clamp(IMoistureSensor sensor) : IMoistureSensor
{
    public int Read() => Math.Clamp(sensor.Read(), 0, 100);
}

public class Smoothed(IMoistureSensor sensor) : IMoistureSensor
{
    private readonly Queue<int> _recent = new();

    public int Read()
    {
        _recent.Enqueue(sensor.Read());
        if (_recent.Count > 3) _recent.Dequeue();
        return _recent.Sum() / _recent.Count;
    }
}
