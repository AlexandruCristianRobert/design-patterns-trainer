var plan = new SeatingPlan();
var log = new ChangeLog();

void Show(string what) => Console.WriteLine($"{what}: Ana {plan.TableOf("Ana")}, Ben {plan.TableOf("Ben")}, Cleo {plan.TableOf("Cleo")}");

log.Run(new SeatGuest(plan, "Ana", 1));
log.Run(new SeatGuest(plan, "Ben", 2));
log.Run(new SeatGuest(plan, "Cleo", 2));
Show("seat three");
log.Run(new MoveGuest(plan, "Cleo", 3));
Show("move Cleo to 3");
log.Run(new SwapGuests(plan, "Ana", "Ben"));
Show("swap Ana and Ben");
log.Undo();
Show("undo");
log.Undo();
Show("undo");
log.Redo();
Show("redo");

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

public class SeatGuest(SeatingPlan plan, string guest, int table) : PlanChange
{
    public void Do() => plan.Place(guest, table);
    public void Undo() => plan.Remove(guest);
}

// Moving has no opposite that works from any table, so it keeps the table the guest left.
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

public class SwapGuests(SeatingPlan plan, string first, string second) : PlanChange
{
    public void Do()
    {
        var a = plan.TableOf(first);
        plan.Place(first, plan.TableOf(second));
        plan.Place(second, a);
    }

    // Swapping again puts both back.
    public void Undo() => Do();
}

// Runs changes, undoes them the last one first, and redoes what was undone.
public class ChangeLog
{
    private readonly Stack<PlanChange> done = new();
    private readonly Stack<PlanChange> undone = new();

    public void Run(PlanChange change)
    {
        change.Do();
        done.Push(change);
        undone.Clear();
    }

    public void Undo()
    {
        if (done.Count == 0) return;
        var change = done.Pop();
        change.Undo();
        undone.Push(change);
    }

    public void Redo()
    {
        if (undone.Count == 0) return;
        var change = undone.Pop();
        change.Do();
        done.Push(change);
    }
}
