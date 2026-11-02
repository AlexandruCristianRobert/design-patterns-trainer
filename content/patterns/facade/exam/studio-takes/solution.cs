var engineer = new Engineer(new SessionControl(new Doors(), new RedLight(), new Mixer(), new Recorder()));
engineer.Take("Blue Hour", 8);
foreach (var line in StudioLog.Lines)
    Console.WriteLine(line);

// Collects what the studio's devices did, in order.
public static class StudioLog
{
    public static List<string> Lines { get; } = [];
}

// The devices. None of them knows SessionControl, and none of them talks to another.
public class Doors
{
    public void Lock() => StudioLog.Lines.Add("doors locked");
    public void Unlock() => StudioLog.Lines.Add("doors unlocked");
}

public class RedLight
{
    public void On() => StudioLog.Lines.Add("red light on");
    public void Off() => StudioLog.Lines.Add("red light off");
}

public class Mixer
{
    public void Arm(int tracks) => StudioLog.Lines.Add($"mixer armed, {tracks} tracks");
}

public class Recorder
{
    public void Start(string song) => StudioLog.Lines.Add($"recording {song}");
    public void Stop() => StudioLog.Lines.Add("recording stopped");
}

// Two simple calls for the engineer. It tells each device what to do, in order; no device ever calls it.
public class SessionControl(Doors doors, RedLight light, Mixer mixer, Recorder recorder)
{
    private bool recording;

    public void Record(string song, int tracks)
    {
        if (recording)
            return;
        doors.Lock();
        light.On();
        mixer.Arm(tracks);
        recorder.Start(song);
        recording = true;
    }

    public void Stop()
    {
        if (!recording)
            return;
        recorder.Stop();
        light.Off();
        doors.Unlock();
        recording = false;
    }
}

// The engineer only knows SessionControl.
public class Engineer(SessionControl control)
{
    public void Take(string song, int tracks)
    {
        control.Record(song, tracks);
        control.Stop();
    }
}
