using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class FloorRobotChecks
{
    static string Where(FloorRobot robot) => $"({robot.X}, {robot.Y}) facing {robot.Facing}";

    static FloorRobot At(int x, int y, string facing)
    {
        var robot = new FloorRobot();
        robot.MoveTo(x, y);
        robot.Face(facing);
        return robot;
    }

    [Check("each-move-runs-and-reverses-itself")]
    static void EachMoveRunsAndReversesItself()
    {
        void Try(FloorRobot robot, RobotMove move, string made, string afterRun)
        {
            var start = Where(robot);
            move.Run();
            var done = Where(robot);
            Expect.That(done == afterRun, "wrongRun", new { move = made, start, expected = afterRun, actual = done });
            move.Reverse();
            var back = Where(robot);
            Expect.That(back == start, "wrongReverse", new { move = made, expected = start, actual = back });
        }

        var robot = At(2, 3, "north");
        Try(robot, new Forward(robot, 2), "Forward(robot, 2)", "(2, 5) facing north");
        Try(robot, new TurnRight(robot), "TurnRight(robot)", "(2, 3) facing east");
        Try(robot, new TurnLeft(robot), "TurnLeft(robot)", "(2, 3) facing west");

        var east = At(2, 3, "east");
        Try(east, new Forward(east, 3), "Forward(robot, 3)", "(5, 3) facing east");
        var south = At(2, 3, "south");
        Try(south, new Forward(south, 4), "Forward(robot, 4)", "(2, -1) facing south");
        var west = At(2, 3, "west");
        Try(west, new Forward(west, 1), "Forward(robot, 1)", "(1, 3) facing west");
        Try(west, new TurnRight(west), "TurnRight(robot)", "(2, 3) facing north");
        Try(west, new TurnLeft(west), "TurnLeft(robot)", "(2, 3) facing south");
    }

    [Check("added-moves-wait-for-go")]
    static void AddedMovesWaitForGo()
    {
        var robot = new FloorRobot();
        var plan = new MovePlan();
        plan.Add(new Forward(robot, 2));
        plan.Add(new TurnRight(robot));
        plan.Add(new Forward(robot, 3));
        var before = Where(robot);
        Expect.That(before == "(0, 0) facing north", "movedTooSoon", new { expected = "(0, 0) facing north", actual = before });
        Expect.That(plan.Waiting == 3, "wrongWaiting", new { moment = "After adding three moves", expected = 3, actual = plan.Waiting });

        plan.Go();
        var after = Where(robot);
        Expect.That(after == "(3, 2) facing east", "wrongGo", new { expected = "(3, 2) facing east", actual = after });
        Expect.That(plan.Waiting == 0, "wrongWaiting", new { moment = "After Go", expected = 0, actual = plan.Waiting });

        plan.Go();
        var again = Where(robot);
        Expect.That(again == "(3, 2) facing east", "ranTwice", new { expected = "(3, 2) facing east", actual = again });
    }

    [Check("go-runs-the-moves-in-the-order-added")]
    static void GoRunsTheMovesInTheOrderAdded()
    {
        var first = new FloorRobot();
        var plan = new MovePlan();
        plan.Add(new Forward(first, 2));
        plan.Add(new TurnRight(first));
        plan.Go();
        var a = Where(first);
        Expect.That(a == "(0, 2) facing east", "wrongOrder", new { moves = "Forward 2, then TurnRight", expected = "(0, 2) facing east", actual = a });

        var second = new FloorRobot();
        var other = new MovePlan();
        other.Add(new TurnRight(second));
        other.Add(new Forward(second, 2));
        other.Go();
        var b = Where(second);
        Expect.That(b == "(2, 0) facing east", "wrongOrder", new { moves = "TurnRight, then Forward 2", expected = "(2, 0) facing east", actual = b });
    }

    [Check("step-back-reverses-the-last-move-first")]
    static void StepBackReversesTheLastMoveFirst()
    {
        var robot = new FloorRobot();
        var plan = new MovePlan();
        plan.Add(new Forward(robot, 2));
        plan.Add(new TurnRight(robot));
        plan.Go();
        plan.Add(new Forward(robot, 3));
        plan.Add(new TurnLeft(robot));
        plan.Add(new TurnLeft(robot));
        plan.Add(new Forward(robot, 1));
        plan.Go();
        var all = Where(robot);
        Expect.That(all == "(2, 2) facing west", "wrongGo", new { expected = "(2, 2) facing west", actual = all });

        string[] expected =
        [
            "(3, 2) facing west",
            "(3, 2) facing north",
            "(3, 2) facing east",
            "(0, 2) facing east",
            "(0, 2) facing north",
            "(0, 0) facing north",
            "(0, 0) facing north",
        ];
        for (var i = 0; i < expected.Length; i++)
        {
            plan.StepBack();
            var now = Where(robot);
            Expect.That(now == expected[i], "wrongStepBack", new { steps = i + 1, expected = expected[i], actual = now });
        }
    }

    [Check("step-back-skips-waiting-moves")]
    static void StepBackSkipsWaitingMoves()
    {
        var robot = new FloorRobot();
        var plan = new MovePlan();
        plan.Add(new Forward(robot, 2));
        plan.Go();
        plan.Add(new TurnRight(robot));
        plan.StepBack();
        var back = Where(robot);
        Expect.That(back == "(0, 0) facing north", "wrongStepBackWithWaiting", new { expected = "(0, 0) facing north", actual = back });
        Expect.That(plan.Waiting == 1, "wrongWaiting", new { moment = "After a step back with one move waiting", expected = 1, actual = plan.Waiting });

        plan.StepBack();
        plan.Go();
        var after = Where(robot);
        Expect.That(after == "(0, 0) facing east", "waitingLost", new { expected = "(0, 0) facing east", actual = after });
    }

    [Check("the-plan-knows-only-robot-moves")]
    static void ThePlanKnowsOnlyRobotMoves()
    {
        var move = typeof(RobotMove);
        foreach (var type in new[] { typeof(Forward), typeof(TurnRight), typeof(TurnLeft) })
            Expect.That(move.IsAssignableFrom(type), "notAMove", new { type = type.Name });

        foreach (var field in typeof(MovePlan).GetFields(AnyField))
            foreach (var concrete in new[] { typeof(Forward), typeof(TurnRight), typeof(TurnLeft), typeof(FloorRobot) })
                Expect.That(!Involves(field.FieldType, concrete), "planHoldsConcrete", new { field = field.Name, type = concrete.Name });

        var named = Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "MovePlan")
            .SelectMany(d => d.DescendantNodes().OfType<SimpleNameSyntax>())
            .FirstOrDefault(n => n.Identifier.ValueText is "Forward" or "TurnRight" or "TurnLeft" or "FloorRobot");
        Expect.That(named is null, "planNamesConcrete", new { type = named?.Identifier.ValueText });
    }

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;

    // A field of this type holds the given type: the type itself, a type made from it, or an array or collection of it.
    static bool Involves(Type fieldType, Type type) =>
        fieldType == type
        || fieldType != typeof(object) && type.IsAssignableFrom(fieldType)
        || fieldType.IsArray && Involves(fieldType.GetElementType()!, type)
        || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Involves(a, type));
}
