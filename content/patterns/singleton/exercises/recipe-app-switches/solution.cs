var settings = new SettingsScreen(AppSwitches.Instance);
var recipe = new RecipeScreen(AppSwitches.Instance);

Console.WriteLine(recipe.Render("Pancakes"));
Console.WriteLine(settings.Toggle("timer"));
Console.WriteLine(recipe.Render("Pancakes"));

public interface IFeatureSwitches
{
    bool IsOn(string feature);
    void Turn(string feature, bool on);
}

// The app's one set of switches. Screens get it as an IFeatureSwitches, so a test can hand them its own.
public sealed class AppSwitches : IFeatureSwitches
{
    public static AppSwitches Instance { get; } = new();

    // An explicit static constructor makes the runtime build Instance exactly when the class is first used.
    static AppSwitches() { }

    private readonly HashSet<string> on = [];

    private AppSwitches() { }

    public bool IsOn(string feature) => on.Contains(feature);

    public void Turn(string feature, bool on)
    {
        if (on) this.on.Add(feature);
        else this.on.Remove(feature);
    }
}

public class RecipeScreen(IFeatureSwitches switches)
{
    public string Render(string recipe)
    {
        var line = recipe;
        if (switches.IsOn("timer")) line += " + timer";
        if (switches.IsOn("video")) line += " + video";
        return line;
    }
}

public class SettingsScreen(IFeatureSwitches switches)
{
    public string Toggle(string feature)
    {
        var now = !switches.IsOn(feature);
        switches.Turn(feature, now);
        return $"{feature}: {(now ? "on" : "off")}";
    }
}
