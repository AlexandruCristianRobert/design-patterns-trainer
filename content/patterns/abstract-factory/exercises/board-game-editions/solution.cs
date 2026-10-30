foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var classic = new GameBox(new ClassicEdition());
        var travel = new GameBox(new TravelEdition());
        return
        [
            classic.Pack("Chess"),
            travel.Pack("Draughts"),
            travel.Pack("Chess"),
        ];
    }
}

public interface IBoard
{
    string Describe();
}

public interface IPieces
{
    string Describe();
}

public class WoodenBoard : IBoard
{
    public string Describe() => "folding wooden board";
}

public class WoodenPieces : IPieces
{
    public string Describe() => "carved wooden pieces";
}

public class MagneticBoard : IBoard
{
    public string Describe() => "roll-up magnetic board";
}

public class MagneticPieces : IPieces
{
    public string Describe() => "magnetic pieces";
}

// Makes the board and the pieces of one edition, so they always fit together.
public abstract class Edition
{
    public abstract IBoard MakeBoard();
    public abstract IPieces MakePieces();
}

public class ClassicEdition : Edition
{
    public override IBoard MakeBoard() => new WoodenBoard();
    public override IPieces MakePieces() => new WoodenPieces();
}

public class TravelEdition : Edition
{
    public override IBoard MakeBoard() => new MagneticBoard();
    public override IPieces MakePieces() => new MagneticPieces();
}

public class GameBox(Edition edition)
{
    public string Pack(string game) => $"{game}: {edition.MakeBoard().Describe()} + {edition.MakePieces().Describe()}";
}
