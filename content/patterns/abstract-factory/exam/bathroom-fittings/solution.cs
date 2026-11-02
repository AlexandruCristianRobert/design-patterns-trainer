Console.WriteLine(new BathroomQuote(new ContemporaryRange()).Quote(2));
Console.WriteLine(new BathroomQuote(new HeritageRange()).Quote(1));

public interface ITap
{
    string Name { get; }
    int Price { get; }
}

public interface IBasin
{
    string Name { get; }
    int Price { get; }
}

public interface IShower
{
    string Name { get; }
    int Price { get; }
}

public class MixerTap : ITap
{
    public string Name => "chrome mixer tap";
    public int Price => 90;
}

public class SquareBasin : IBasin
{
    public string Name => "square basin";
    public int Price => 220;
}

public class RainShower : IShower
{
    public string Name => "rain shower";
    public int Price => 310;
}

public class CrossTap : ITap
{
    public string Name => "brass cross tap";
    public int Price => 140;
}

public class PedestalBasin : IBasin
{
    public string Name => "pedestal basin";
    public int Price => 360;
}

public class TelephoneShower : IShower
{
    public string Name => "telephone shower";
    public int Price => 280;
}

// Makes every fitting in one range, so a bathroom never mixes two ranges.
public abstract class FittingRange
{
    public abstract ITap MakeTap();
    public abstract IBasin MakeBasin();
    public abstract IShower MakeShower();
}

public class ContemporaryRange : FittingRange
{
    public override ITap MakeTap() => new MixerTap();
    public override IBasin MakeBasin() => new SquareBasin();
    public override IShower MakeShower() => new RainShower();
}

public class HeritageRange : FittingRange
{
    public override ITap MakeTap() => new CrossTap();
    public override IBasin MakeBasin() => new PedestalBasin();
    public override IShower MakeShower() => new TelephoneShower();
}

public class BathroomQuote(FittingRange range)
{
    public string Quote(int taps)
    {
        var tap = range.MakeTap();
        var basin = range.MakeBasin();
        var shower = range.MakeShower();
        var total = taps * tap.Price + basin.Price + shower.Price;
        return $"{taps} x {tap.Name}, {basin.Name}, {shower.Name}: {total} EUR";
    }
}
