List<string> photos = ["beach.jpg", "cake.jpg", "snow.jpg"];
foreach (var line in new InOrder(new LcdFrame()).Run(photos))
    Console.WriteLine(line);
foreach (var line in new NewestFirst(new TvStick()).Run(photos))
    Console.WriteLine(line);

// What every screen can do: show one photo, or show a caption.
public abstract class Screen
{
    public abstract string Picture(string photo);
    public abstract string Caption(string text);
}

public class LcdFrame : Screen
{
    public override string Picture(string photo) => $"lcd: {photo}";
    public override string Caption(string text) => $"lcd caption: {text}";
}

public class TvStick : Screen
{
    public override string Picture(string photo) => $"tv full screen: {photo}";
    public override string Caption(string text) => $"tv banner: {text}";
}

// A slideshow holds the screen it runs on and decides only the order and the captions.
public abstract class Slideshow(Screen screen)
{
    protected Screen Screen => screen;

    public abstract List<string> Run(List<string> photos);
}

public class InOrder(Screen screen) : Slideshow(screen)
{
    public override List<string> Run(List<string> photos) =>
        [.. photos.Select(Screen.Picture), Screen.Caption($"{photos.Count} photos")];
}

public class NewestFirst(Screen screen) : Slideshow(screen)
{
    public override List<string> Run(List<string> photos) =>
        [Screen.Caption("newest first"), .. Enumerable.Reverse(photos).Select(Screen.Picture)];
}
