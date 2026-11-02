foreach (var line in new OutAndBack(new Quadcopter(), 300).Plan())
    Console.WriteLine(line);
foreach (var line in new GridSweep(new FixedWing(), 3, 500).Plan())
    Console.WriteLine(line);

// What every drone can do: fly straight for some metres, or turn by some degrees.
public abstract class Drone
{
    public abstract string Fly(int metres);
    public abstract string Turn(int degrees);
}

public class Quadcopter : Drone
{
    public override string Fly(int metres) => $"quad fly {metres} m";
    public override string Turn(int degrees) => $"quad turn {degrees}";
}

public class FixedWing : Drone
{
    public override string Fly(int metres) => $"wing glide {metres} m";
    public override string Turn(int degrees) => $"wing bank {degrees}";
}

// A flight holds the drone that flies it and decides only the route.
public abstract class Flight(Drone drone)
{
    protected Drone Drone => drone;

    public abstract List<string> Plan();
}

public class OutAndBack(Drone drone, int distance) : Flight(drone)
{
    public override List<string> Plan() => [Drone.Fly(distance), Drone.Turn(180), Drone.Fly(distance)];
}

public class GridSweep(Drone drone, int rows, int length) : Flight(drone)
{
    public override List<string> Plan()
    {
        var steps = new List<string>();
        for (var row = 1; row <= rows; row++)
        {
            if (row > 1)
            {
                steps.Add(Drone.Turn(90));
                steps.Add(Drone.Fly(10));
                steps.Add(Drone.Turn(90));
            }
            steps.Add(Drone.Fly(length));
        }
        return steps;
    }
}
