Console.WriteLine(new Stage(new RockHire()).Soundcheck("The Foxes"));
Console.WriteLine(new Stage(new AcousticHire()).Soundcheck("Lena Moor"));

public interface ISpeaker
{
    string Name { get; }
    int Watts { get; }
}

public interface ILights
{
    string Name { get; }
}

public class StackSpeaker : ISpeaker
{
    public string Name => "speaker stack";
    public int Watts => 5000;
}

public class WedgeSpeaker : ISpeaker
{
    public string Name => "wedge monitor";
    public int Watts => 800;
}

public class StrobeLights : ILights
{
    public string Name => "strobes";
}

public class WarmSpotlights : ILights
{
    public string Name => "warm spotlights";
}

// Hires out the speaker and the lights for one kind of stage, so they always suit each other.
public abstract class StageHire
{
    public abstract ISpeaker HireSpeaker();
    public abstract ILights HireLights();
}

public class RockHire : StageHire
{
    public override ISpeaker HireSpeaker() => new StackSpeaker();
    public override ILights HireLights() => new StrobeLights();
}

public class AcousticHire : StageHire
{
    public override ISpeaker HireSpeaker() => new WedgeSpeaker();
    public override ILights HireLights() => new WarmSpotlights();
}

public class Stage(StageHire hire)
{
    public string Soundcheck(string band)
    {
        var speaker = hire.HireSpeaker();
        var lights = hire.HireLights();
        var line = $"{band}: {speaker.Name}, {speaker.Watts} W, {lights.Name}";
        return speaker.Watts > 1000 ? line + ", ear plugs handed out" : line;
    }
}
