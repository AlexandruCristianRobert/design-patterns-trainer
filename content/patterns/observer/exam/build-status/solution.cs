var server = new BuildServer();
var chat = new ChatBot();
var wall = new StatusWall();
server.AddWatcher(chat);
server.AddWatcher(wall);

server.FinishBuild("web", passed: true);

server.RemoveWatcher(chat);
server.FinishBuild("api", passed: false);

public interface IBuildWatcher
{
    void OnBuildFinished(string project, bool passed);
}

public class BuildServer
{
    private readonly List<IBuildWatcher> _watchers = [];

    public void AddWatcher(IBuildWatcher watcher) => _watchers.Add(watcher);

    public void RemoveWatcher(IBuildWatcher watcher) => _watchers.Remove(watcher);

    public void FinishBuild(string project, bool passed)
    {
        // Loop over a copy: a watcher may remove itself while being told.
        foreach (var watcher in _watchers.ToList())
            watcher.OnBuildFinished(project, passed);
    }
}

public class ChatBot : IBuildWatcher
{
    public void OnBuildFinished(string project, bool passed) =>
        Console.WriteLine($"chat: {project} {(passed ? "is green" : "is broken")}");
}

public class StatusWall : IBuildWatcher
{
    public void OnBuildFinished(string project, bool passed) =>
        Console.WriteLine($"wall: {project} = {(passed ? "PASS" : "FAIL")}");
}
