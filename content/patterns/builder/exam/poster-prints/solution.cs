var order = new PosterOrder("gig.pdf");
order.Laminate();
order.Copies(50);
order.Size("A2");
var job = order.Send();
Console.WriteLine(job.Ticket());

try
{
    order.Copies(60);
}
catch (InvalidOperationException problem)
{
    Console.WriteLine($"refused: {problem.Message}");
}

var folded = new PosterOrder("map.pdf");
folded.Fold();
folded.Laminate();
try
{
    folded.Send();
}
catch (InvalidOperationException problem)
{
    Console.WriteLine($"rejected: {problem.Message}");
}

// What the print room receives. It is read-only.
public class PrintJob(string ticket)
{
    public string Ticket() => ticket;
}

// Collects the choices in any order; Send() checks them and closes the order.
public class PosterOrder(string file)
{
    private string size = "A3";
    private int copies = 1;
    private bool laminated;
    private bool folded;
    private bool sent;

    public void Size(string paper) { Open(); size = paper; }
    public void Copies(int count) { Open(); copies = count; }
    public void Laminate() { Open(); laminated = true; }
    public void Fold() { Open(); folded = true; }

    public PrintJob Send()
    {
        Open();
        if (laminated && folded)
            throw new InvalidOperationException("A laminated poster cannot be folded.");
        if (copies < 1)
            throw new InvalidOperationException("Order at least 1 copy.");
        sent = true;
        return new PrintJob($"{file}: {copies} x {size}{(laminated ? ", laminated" : "")}{(folded ? ", folded" : "")}");
    }

    private void Open()
    {
        if (sent) throw new InvalidOperationException("This order has already been sent.");
    }
}
