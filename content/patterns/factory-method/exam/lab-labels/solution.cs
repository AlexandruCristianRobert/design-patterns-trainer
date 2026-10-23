foreach (var line in new BloodRun().Process(["A-17", "B-02"]))
    Console.WriteLine(line);

foreach (var line in new WaterRun().Process(["river", "well", "tap"]))
    Console.WriteLine(line);

public interface ILabel
{
    string Print(string sample, int number);

    // How much of the label roll one label uses, in millimetres.
    int Width { get; }
}

public class BarcodeLabel : ILabel
{
    public string Print(string sample, int number) => $"||| {number:D3} {sample}";
    public int Width => 30;
}

public class QrLabel : ILabel
{
    public string Print(string sample, int number) => $"[QR] {sample} #{number}";
    public int Width => 20;
}

public abstract class SampleRun
{
    // Each lab decides which label goes on its samples.
    protected abstract ILabel NewLabel();

    public List<string> Process(List<string> samples)
    {
        var lines = new List<string>();
        var roll = 0;
        for (var i = 0; i < samples.Count; i++)
        {
            var label = NewLabel();
            lines.Add(label.Print(samples[i], i + 1));
            roll += label.Width;
        }
        lines.Add($"roll used: {roll} mm");
        return lines;
    }
}

public class BloodRun : SampleRun
{
    protected override ILabel NewLabel() => new BarcodeLabel();
}

public class WaterRun : SampleRun
{
    protected override ILabel NewLabel() => new QrLabel();
}
