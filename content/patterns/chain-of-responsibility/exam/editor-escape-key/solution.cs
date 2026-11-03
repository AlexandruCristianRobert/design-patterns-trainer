var escape = new EscapeKey();
Console.WriteLine(escape.Press(new EditorView(true, "intro.mp4", 3)));
Console.WriteLine(escape.Press(new EditorView(false, "intro.mp4", 3)));
Console.WriteLine(escape.Press(new EditorView(false, "", 3)));
Console.WriteLine(escape.Press(new EditorView(false, "", 0)));

// What is open in the editor when Escape is pressed.
public record EditorView(bool ExportOpen, string TrimmingClip, int SelectedClips);

// Every part of the editor that may close something on Escape.
public interface EditorPart
{
    string OnEscape(EditorView view);
}

// Each part is created with the part after it, or with null when it is the last one.
public class ExportDialog(EditorPart? next) : EditorPart
{
    public string OnEscape(EditorView view) =>
        view.ExportOpen ? "Export dialog closed" : next?.OnEscape(view) ?? "Nothing to close";
}

public class TrimTool(EditorPart? next) : EditorPart
{
    public string OnEscape(EditorView view) =>
        view.TrimmingClip != "" ? $"Trim of {view.TrimmingClip} cancelled" : next?.OnEscape(view) ?? "Nothing to close";
}

public class ClipSelection(EditorPart? next) : EditorPart
{
    public string OnEscape(EditorView view) =>
        view.SelectedClips > 0 ? $"{view.SelectedClips} clips unselected" : next?.OnEscape(view) ?? "Nothing to close";
}

// The Escape key puts the parts in line once and keeps only the first.
public class EscapeKey
{
    private readonly EditorPart first = new ExportDialog(new TrimTool(new ClipSelection(null)));

    public string Press(EditorView view) => first.OnEscape(view);
}
