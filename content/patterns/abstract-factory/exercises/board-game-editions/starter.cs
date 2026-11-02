foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        var classic = new GameBox(new WoodenBoard(), new WoodenPieces());
        var travel = new GameBox(new MagneticBoard(), new MagneticPieces());
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

// Whoever creates a box hands it a board and pieces separately,
// so nothing stops a magnetic board ending up with wooden pieces.
public class GameBox(IBoard board, IPieces pieces)
{
    public string Pack(string game) => $"{game}: {board.Describe()} + {pieces.Describe()}";
}
