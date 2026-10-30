Console.WriteLine(new PaintJob(new WaterBased()).Order(30));
Console.WriteLine(new PaintJob(new OilBased()).Order(30));

public interface IPrimer
{
    string Name { get; }
    int SquareMetresPerLitre { get; }
}

public interface ITopcoat
{
    string Name { get; }
    int SquareMetresPerLitre { get; }
}

public class AcrylicPrimer : IPrimer
{
    public string Name => "acrylic primer";
    public int SquareMetresPerLitre => 10;
}

public class MattEmulsion : ITopcoat
{
    public string Name => "matt emulsion";
    public int SquareMetresPerLitre => 12;
}

public class OilPrimer : IPrimer
{
    public string Name => "oil primer";
    public int SquareMetresPerLitre => 8;
}

public class OilGloss : ITopcoat
{
    public string Name => "oil gloss";
    public int SquareMetresPerLitre => 15;
}

// Makes the primer and the topcoat of one paint system, so the two coats always bond.
public interface PaintSystem
{
    IPrimer NewPrimer();
    ITopcoat NewTopcoat();
}

public class WaterBased : PaintSystem
{
    public IPrimer NewPrimer() => new AcrylicPrimer();
    public ITopcoat NewTopcoat() => new MattEmulsion();
}

public class OilBased : PaintSystem
{
    public IPrimer NewPrimer() => new OilPrimer();
    public ITopcoat NewTopcoat() => new OilGloss();
}

public class PaintJob(PaintSystem system)
{
    public string Order(int squareMetres)
    {
        var primer = system.NewPrimer();
        var topcoat = system.NewTopcoat();
        return $"{squareMetres} sq m: {Litres(squareMetres, primer.SquareMetresPerLitre)} L {primer.Name} + {Litres(squareMetres, topcoat.SquareMetresPerLitre)} L {topcoat.Name}";
    }

    // Whole litres, rounded up, so there is always enough.
    private static int Litres(int squareMetres, int perLitre) => (squareMetres + perLitre - 1) / perLitre;
}
