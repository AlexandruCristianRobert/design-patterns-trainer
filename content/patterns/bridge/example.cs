// Every control style works on every output: pick one of each.
foreach (IAudioOutput output in new IAudioOutput[] { new Speaker(), new Headphones() })
{
    new BasicPlayer(output).Play("Episode 12");

    var podcast = new PodcastPlayer(output);
    podcast.Play("Episode 12");
    podcast.Skip30();
    podcast.Faster();
}

// The implementor: the small steps every output can do.
public interface IAudioOutput
{
    void Start(string title);
    void Stop();
    void Seek(int seconds);
    void SetSpeed(double factor);
}

public class Speaker : IAudioOutput
{
    public void Start(string title) => Console.WriteLine($"Speaker: playing {title}");
    public void Stop() => Console.WriteLine("Speaker: stopped");
    public void Seek(int seconds) => Console.WriteLine($"Speaker: jump {seconds} s");
    public void SetSpeed(double factor) => Console.WriteLine($"Speaker: speed {factor}x");
}

public class Headphones : IAudioOutput
{
    public void Start(string title) => Console.WriteLine($"Headphones: playing {title}");
    public void Stop() => Console.WriteLine("Headphones: stopped");
    public void Seek(int seconds) => Console.WriteLine($"Headphones: jump {seconds} s");
    public void SetSpeed(double factor) => Console.WriteLine($"Headphones: speed {factor}x");
}

// The abstraction: the controls. It holds an output and delegates to it.
public abstract class Player(IAudioOutput output)
{
    protected IAudioOutput Output => output;

    public void Play(string title) => output.Start(title);
    public void Pause() => output.Stop();
}

// Refined abstractions: new controls, built from the output's small steps.
public class BasicPlayer(IAudioOutput output) : Player(output);

public class PodcastPlayer(IAudioOutput output) : Player(output)
{
    public void Skip30() => Output.Seek(30);
    public void Faster() => Output.SetSpeed(1.5);
}
