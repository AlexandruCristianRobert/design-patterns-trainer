var plan = new SeatingPlan();
var log = new ChangeLog();

void Show(string what) => Console.WriteLine($"{what}: Ana {plan.TableOf("Ana")}, Ben {plan.TableOf("Ben")}");

log.Run(new SeatGuest(plan, "Ana", 1));
log.Run(new SeatGuest(plan, "Ben", 2));
Show("seat Ana and Ben");
log.Run(new MoveGuest(plan, "Ana", 3));
Show("move Ana to 3");
log.Undo();
Show("undo");
log.Undo();
Show("undo");

// Which table each wedding guest sits at.
public class SeatingPlan
{
    private readonly Dictionary<string, int> tables = [];

    public int TableOf(string guest) => tables.GetValueOrDefault(guest);
    public void Place(string guest, int table) => tables[guest] = table;
    public void Remove(string guest) => tables.Remove(guest);
}

// Every change to the plan can do itself and undo itself.
public interface PlanChange
{
    void Do();
    void Undo();
}

// Seating has an opposite: unseating.
public class SeatGuest(SeatingPlan plan, string guest, int table) : PlanChange
{
    public void Do() => plan.Place(guest, table);
    public void Undo() => plan.Remove(guest);
}

// Moving has no opposite, so it keeps the table the guest left.
public class MoveGuest(SeatingPlan plan, string guest, int table) : PlanChange
{
    private int before;

    public void Do()
    {
        before = plan.TableOf(guest);
        plan.Place(guest, table);
    }

    public void Undo() => plan.Place(guest, before);
}

// Runs changes and undoes them, the last one first.
public class ChangeLog
{
    private readonly Stack<PlanChange> done = new();

    public void Run(PlanChange change)
    {
        change.Do();
        done.Push(change);
    }

    public void Undo()
    {
        if (done.TryPop(out var change)) change.Undo();
    }
}
