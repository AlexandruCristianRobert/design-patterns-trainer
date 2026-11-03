var robot = new FloorRobot();
var plan = new MovePlan();

void Show(string what) => Console.WriteLine($"{what}: ({robot.X}, {robot.Y}) facing {robot.Facing}, {plan.Waiting} waiting");

plan.Add(new Forward(robot, 2));
plan.Add(new TurnRight(robot));
plan.Add(new Forward(robot, 3));
Show("three moves added");
plan.Go();
Show("go");
plan.StepBack();
Show("step back");
plan.StepBack();
Show("step back");

public class FloorRobot
{
    public int X { get; private set; }
    public int Y { get; private set; }
    public string Facing { get; private set; } = "north";

    public void MoveTo(int x, int y) => (X, Y) = (x, y);
    public void Face(string direction) => Facing = direction;
}

// Every move can run itself on its robot and reverse itself.
public interface RobotMove
{
    void Run();
    void Reverse();
}

public class Forward(FloorRobot robot, int squares) : RobotMove
{
    public void Run() => Go(squares);
    public void Reverse() => Go(-squares);

    private void Go(int n)
    {
        var (dx, dy) = robot.Facing switch
        {
            "north" => (0, 1),
            "east" => (1, 0),
            "south" => (0, -1),
            _ => (-1, 0),
        };
        robot.MoveTo(robot.X + dx * n, robot.Y + dy * n);
    }
}

public class TurnRight(FloorRobot robot) : RobotMove
{
    public void Run() => Turns.By(robot, 1);
    public void Reverse() => Turns.By(robot, 3);
}

public class TurnLeft(FloorRobot robot) : RobotMove
{
    public void Run() => Turns.By(robot, 3);
    public void Reverse() => Turns.By(robot, 1);
}

static class Turns
{
    private static readonly string[] Clockwise = ["north", "east", "south", "west"];

    // Turns the robot a number of quarter turns to the right.
    public static void By(FloorRobot robot, int quarters) =>
        robot.Face(Clockwise[(Array.IndexOf(Clockwise, robot.Facing) + quarters) % 4]);
}

// Moves wait in the plan until Go runs them; the plan keeps what it ran, so it can step back.
public class MovePlan
{
    private readonly Queue<RobotMove> waiting = new();
    private readonly Stack<RobotMove> ran = new();

    public int Waiting => waiting.Count;

    public void Add(RobotMove move) => waiting.Enqueue(move);

    public void Go()
    {
        while (waiting.Count > 0)
        {
            var move = waiting.Dequeue();
            move.Run();
            ran.Push(move);
        }
    }

    public void StepBack()
    {
        if (ran.Count > 0)
            ran.Pop().Reverse();
    }
}
