using System.Reflection;
using DesignPatterns.Checks;

static class MoistureChecks
{
    // Gives the readings it was set up with in turn, repeating the last one, and counts how often it was read.
    sealed class TestSensor(params int[] readings) : IMoistureSensor
    {
        public int Reads { get; private set; }

        public int Read() => readings[Math.Min(Reads++, readings.Length - 1)];
    }

    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Every instance field of the type, including those declared in its base classes.
    static List<FieldInfo> Fields(Type type)
    {
        var fields = new List<FieldInfo>();
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            fields.AddRange(t.GetFields(Declared));
        return fields;
    }

    static string ReadAll(IMoistureSensor sensor, int times) =>
        string.Join(", ", Enumerable.Range(0, times).Select(_ => sensor.Read()));

    [Check("clamp-keeps-0-to-100")]
    static void ClampKeeps0To100()
    {
        var inside = new TestSensor(-7, 0, 55, 100, 130);
        var readings = ReadAll(new Clamp(inside), 5);

        Expect.That(readings == "0, 0, 55, 100, 100", "wrongClamp", new { actual = readings });
        Expect.That(inside.Reads == 5, "clampReadCount", new { reads = inside.Reads });
    }

    [Check("smoothed-averages-the-last-three")]
    static void SmoothedAveragesTheLastThree()
    {
        var inside = new TestSensor(30, 60, 90, 10, 20);
        var readings = ReadAll(new Smoothed(inside), 5);

        Expect.That(readings == "30, 45, 60, 53, 40", "wrongAverage", new { actual = readings });
        Expect.That(inside.Reads == 5, "smoothedReadCount", new { reads = inside.Reads });
    }

    [Check("pieces-combine-in-any-order")]
    static void PiecesCombineInAnyOrder()
    {
        var clampLast = ReadAll(new Clamp(new Smoothed(new Offset(new TestSensor(95, 95, 50), 10))), 3);
        var smoothLast = ReadAll(new Smoothed(new Clamp(new Offset(new TestSensor(95, 95, 50), 10))), 3);
        var twice = ReadAll(new Offset(new Offset(new TestSensor(40), 3), -5), 1);

        Expect.That(clampLast == "100, 100, 90", "wrongClampLast", new { actual = clampLast });
        Expect.That(smoothLast == "100, 100, 86", "wrongSmoothLast", new { actual = smoothLast });
        Expect.That(twice == "38", "wrongOffsetTwice", new { actual = twice });
    }

    [Check("pieces-hold-any-sensor")]
    static void PiecesHoldAnySensor()
    {
        var sensor = typeof(IMoistureSensor);
        foreach (var piece in new[] { typeof(Offset), typeof(Clamp), typeof(Smoothed) })
        {
            Expect.That(sensor.IsAssignableFrom(piece), "notASensor", new { type = piece.Name });

            var fields = Fields(piece);
            Expect.That(fields.Any(f => f.FieldType == sensor), "holdsNoSensor", new { type = piece.Name });

            var concrete = fields.FirstOrDefault(f => f.FieldType != sensor && sensor.IsAssignableFrom(f.FieldType));
            Expect.That(concrete is null, "holdsConcreteSensor", new { type = piece.Name, held = concrete?.FieldType.Name });
        }
    }
}
