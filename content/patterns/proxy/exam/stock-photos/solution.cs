var page = new SearchPage([new PhotoListing("red fox", licensed: true), new PhotoListing("lighthouse", licensed: false)]);
Console.WriteLine(page.Previews());
Console.WriteLine($"Photos loaded: {FullPhoto.Loaded}");
var fox = new PhotoListing("red fox", licensed: true);
Console.WriteLine(fox.Download());
Console.WriteLine(fox.Download());
Console.WriteLine(new PhotoListing("lighthouse", licensed: false).Download());
Console.WriteLine($"Photos loaded: {FullPhoto.Loaded}");

public interface IPhoto
{
    string Preview();
    string Download();
}

// The real photo at full size. Loading one is slow and heavy, so Loaded counts every photo loaded.
public class FullPhoto : IPhoto
{
    public static int Loaded { get; private set; }

    private readonly string name;

    public FullPhoto(string name)
    {
        this.name = name;
        Loaded++;
    }

    public string Preview() => $"{name}, small preview";

    public string Download() => $"{name}.jpg, 6000 x 4000";
}

// Controls access to one full-size photo: it answers previews itself,
// and loads the photo on the first download by a customer with a licence.
public class PhotoListing(string name, bool licensed) : IPhoto
{
    private FullPhoto? photo;

    public string Preview() => $"{name}, small preview";

    public string Download()
    {
        if (!licensed)
            return $"Buy a licence to download {name}";

        photo ??= new FullPhoto(name);
        return photo.Download();
    }
}

// The search results. They show previews only.
public class SearchPage(List<IPhoto> photos)
{
    public string Previews() => string.Join(" / ", photos.Select(p => p.Preview()));
}
