foreach (var line in new PickAndPlace(new KaroArm(), 3, 4, 12, 0).Run())
    Console.WriteLine(line);
foreach (var line in new Park(new TeslinArm()).Run())
    Console.WriteLine(line);

// What every robot arm can do, each in its maker's own format. Positions are in centimetres.
public abstract class Arm
{
    public abstract string MoveTo(int x, int y);
    public abstract string Grip(bool closed);
}

public class KaroArm : Arm
{
    public override string MoveTo(int x, int y) => $"KARO GOTO {x * 10} {y * 10}";
    public override string Grip(bool closed) => closed ? "KARO CLAMP" : "KARO OPEN";
}

public class TeslinArm : Arm
{
    public override string MoveTo(int x, int y) => $"teslin.move({x}cm, {y}cm)";
    public override string Grip(bool closed) => closed ? "teslin.grip(on)" : "teslin.grip(off)";
}

// A job holds the arm it runs on and decides only which moves it needs.
public abstract class Job(Arm arm)
{
    protected Arm Arm => arm;

    public abstract List<string> Run();
}

public class PickAndPlace(Arm arm, int fromX, int fromY, int toX, int toY) : Job(arm)
{
    public override List<string> Run() =>
        [Arm.MoveTo(fromX, fromY), Arm.Grip(true), Arm.MoveTo(toX, toY), Arm.Grip(false)];
}

public class Park(Arm arm) : Job(arm)
{
    public override List<string> Run() => [Arm.Grip(false), Arm.MoveTo(0, 0)];
}
