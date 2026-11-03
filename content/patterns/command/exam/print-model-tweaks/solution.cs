var model = new PrintModel();
var log = new EditLog();

void Show(string what) => Console.WriteLine($"{what}: scale {model.Scale}, angle {model.Angle}, material {model.Material} [{log.Applied()}]");

log.Apply(new ScaleBy(model, 20));
Show("scale");
log.Apply(new RotateRight(model));
Show("rotate");
log.Apply(new UseMaterial(model, "resin"));
Show("material");
log.StepBack();
Show("step back");
log.StepBack();
Show("step back");

public class PrintModel
{
    public int Scale { get; private set; } = 100;
    public int Angle { get; private set; }
    public string Material { get; private set; } = "PLA";

    public void SetScale(int percent) => Scale = percent;
    public void SetAngle(int degrees) => Angle = degrees;
    public void SetMaterial(string name) => Material = name;
}

// Every tweak can apply itself to its model and take itself back.
public interface Tweak
{
    string Name { get; }
    void Apply();
    void Revert();
}

public class ScaleBy(PrintModel model, int percent) : Tweak
{
    public string Name => $"scale {percent:+0;-0}";
    public void Apply() => model.SetScale(model.Scale + percent);
    public void Revert() => model.SetScale(model.Scale - percent);
}

public class RotateRight(PrintModel model) : Tweak
{
    public string Name => "rotate right";
    public void Apply() => model.SetAngle((model.Angle + 90) % 360);
    public void Revert() => model.SetAngle((model.Angle + 270) % 360);
}

// A material has no opposite, so it keeps the material it replaced.
public class UseMaterial(PrintModel model, string material) : Tweak
{
    private string before = "";

    public string Name => $"material {material}";

    public void Apply()
    {
        before = model.Material;
        model.SetMaterial(material);
    }

    public void Revert() => model.SetMaterial(before);
}

// Applies tweaks and keeps them, so they can be taken back, the last one first.
public class EditLog
{
    private readonly List<Tweak> applied = [];

    public void Apply(Tweak tweak)
    {
        tweak.Apply();
        applied.Add(tweak);
    }

    public void StepBack()
    {
        if (applied.Count == 0) return;
        applied[^1].Revert();
        applied.RemoveAt(applied.Count - 1);
    }

    public string Applied() => applied.Count == 0 ? "nothing" : string.Join(", ", applied.Select(t => t.Name));
}
