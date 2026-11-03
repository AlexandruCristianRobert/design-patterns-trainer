var ticket = new JobTicket([new Hem("trousers", false), new TakeIn("dress", 3), new NewZip("jacket")]);
Console.WriteLine($"standard: {ticket.StandardPrice()} EUR, express: {ticket.ExpressPrice()} EUR, {ticket.Minutes()} minutes");

// Every kind of alteration is written on a job sheet, which answers with a number for it.
public interface IAlteration
{
    int WriteOn(JobSheet sheet);
}

public abstract class JobSheet
{
    public abstract int For(Hem hem);
    public abstract int For(TakeIn takeIn);
    public abstract int For(NewZip zip);
}

public record Hem(string Garment, bool Lined) : IAlteration
{
    public int WriteOn(JobSheet sheet) => sheet.For(this);
}

public record TakeIn(string Garment, int Cm) : IAlteration
{
    public int WriteOn(JobSheet sheet) => sheet.For(this);
}

public record NewZip(string Garment) : IAlteration
{
    public int WriteOn(JobSheet sheet) => sheet.For(this);
}

public sealed class StandardPrices : JobSheet
{
    public override int For(Hem hem) => hem.Lined ? 18 : 12;
    public override int For(TakeIn takeIn) => 15 + 2 * takeIn.Cm;
    public override int For(NewZip zip) => 18;
}

public sealed class ExpressPrices : JobSheet
{
    public override int For(Hem hem) => hem.Lined ? 26 : 20;
    public override int For(TakeIn takeIn) => 2 * (15 + 2 * takeIn.Cm);
    public override int For(NewZip zip) => 28;
}

public sealed class SewingTime : JobSheet
{
    public override int For(Hem hem) => hem.Lined ? 45 : 30;
    public override int For(TakeIn takeIn) => 40;
    public override int For(NewZip zip) => 25;
}

public class JobTicket(List<IAlteration> jobs)
{
    int Total(JobSheet sheet) => jobs.Sum(job => job.WriteOn(sheet));

    public int StandardPrice() => Total(new StandardPrices());
    public int ExpressPrice() => Total(new ExpressPrices());
    public int Minutes() => Total(new SewingTime());
}
