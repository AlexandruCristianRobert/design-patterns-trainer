foreach (var line in new PhotoUploader(new NimbusAccount()).Upload(["cat.jpg", "dog.jpg"]))
    Console.WriteLine(line);

foreach (var line in new PhotoUploader(new StratusAccount()).Upload(["owl.png"]))
    Console.WriteLine(line);

public interface IBlobStore
{
    // Saves a file and returns where it was saved.
    string Save(string name);
}

public interface IMessageQueue
{
    // Sends a message and returns what the queue logged.
    string Send(string message);
}

public class NimbusStore : IBlobStore
{
    public string Save(string name) => $"nimbus://photos/{name}";
}

public class NimbusQueue : IMessageQueue
{
    public string Send(string message) => $"nimbus-queue <- {message}";
}

public class StratusStore : IBlobStore
{
    public string Save(string name) => $"stratus:/blobs/{name}";
}

public class StratusQueue : IMessageQueue
{
    public string Send(string message) => $"stratus-mq: {message}";
}

// Opens the store and the queue of one cloud, so an upload never mixes two clouds.
public abstract class CloudAccount
{
    public abstract IBlobStore OpenStore();
    public abstract IMessageQueue OpenQueue();
}

public class NimbusAccount : CloudAccount
{
    public override IBlobStore OpenStore() => new NimbusStore();
    public override IMessageQueue OpenQueue() => new NimbusQueue();
}

public class StratusAccount : CloudAccount
{
    public override IBlobStore OpenStore() => new StratusStore();
    public override IMessageQueue OpenQueue() => new StratusQueue();
}

public class PhotoUploader(CloudAccount account)
{
    public List<string> Upload(List<string> photos)
    {
        var store = account.OpenStore();
        var queue = account.OpenQueue();
        var lines = new List<string>();
        foreach (var photo in photos)
            lines.Add(queue.Send($"resize {store.Save(photo)}"));
        lines.Add($"{photos.Count} photos uploaded");
        return lines;
    }
}
