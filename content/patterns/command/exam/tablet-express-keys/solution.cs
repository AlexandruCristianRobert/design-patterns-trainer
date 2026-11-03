var sketch = new Sketch();
var keys = new ExpressKeys();
keys.Assign(1, new ZoomIn(sketch));
keys.Assign(2, new AddLayer(sketch));
keys.Assign(3, new ToggleGrid(sketch));

void Show(string what) => Console.WriteLine($"{what}: zoom {sketch.Zoom}, layers {sketch.Layers}, grid {(sketch.Grid ? "on" : "off")}");

keys.Press(1);
keys.Press(1);
Show("key 1 twice");
keys.Press(2);
keys.Press(3);
Show("keys 2 and 3");
keys.TakeBackLast();
Show("take back");
keys.TakeBackLast();
keys.TakeBackLast();
Show("take back twice");

public class Sketch
{
    public int Zoom { get; private set; } = 100;
    public int Layers { get; private set; } = 1;
    public bool Grid { get; private set; }

    public void SetZoom(int percent) => Zoom = percent;
    public void SetLayers(int count) => Layers = count;
    public void SetGrid(bool on) => Grid = on;
}

// Every action a key can be given: it can be performed on its sketch and taken back.
public interface KeyAction
{
    void Perform();
    void TakeBack();
}

public class ZoomIn(Sketch sketch) : KeyAction
{
    public void Perform() => sketch.SetZoom(sketch.Zoom + 25);
    public void TakeBack() => sketch.SetZoom(sketch.Zoom - 25);
}

public class AddLayer(Sketch sketch) : KeyAction
{
    public void Perform() => sketch.SetLayers(sketch.Layers + 1);
    public void TakeBack() => sketch.SetLayers(sketch.Layers - 1);
}

public class ToggleGrid(Sketch sketch) : KeyAction
{
    public void Perform() => sketch.SetGrid(!sketch.Grid);
    public void TakeBack() => sketch.SetGrid(!sketch.Grid);
}

// The tablet's keys. Each key holds an action; the keys remember every action performed, so it can be taken back.
public class ExpressKeys
{
    private readonly Dictionary<int, KeyAction> assigned = [];
    private readonly Stack<KeyAction> performed = new();

    public void Assign(int key, KeyAction action) => assigned[key] = action;

    public void Press(int key)
    {
        if (!assigned.TryGetValue(key, out var action)) return;
        action.Perform();
        performed.Push(action);
    }

    public void TakeBackLast()
    {
        if (performed.Count > 0)
            performed.Pop().TakeBack();
    }
}
