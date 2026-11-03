var loan = new Loan([new Painting("Harbour at Dawn", 70, 90), new Sculpture("Sleeping Fox", 180), new Manuscript("Book of Hours", 240)]);
Console.WriteLine($"shipping: {loan.ShippingCost()} EUR");
foreach (var line in loan.CustomsList())
    Console.WriteLine(line);

public interface IExhibit
{
    void SubmitTo(ILoanCheck check);
}

public interface ILoanCheck
{
    void Check(Painting painting);
    void Check(Sculpture sculpture);
    void Check(Manuscript manuscript);
}

public record Painting(string Title, int Width, int Height) : IExhibit
{
    public void SubmitTo(ILoanCheck check) => check.Check(this);
}

public record Sculpture(string Title, int Kg) : IExhibit
{
    public void SubmitTo(ILoanCheck check) => check.Check(this);
}

public record Manuscript(string Title, int Pages) : IExhibit
{
    public void SubmitTo(ILoanCheck check) => check.Check(this);
}

public class CrateCosts : ILoanCheck
{
    public int Euros { get; private set; }

    public void Check(Painting painting) => Euros += 40 + (painting.Width + painting.Height) / 10;
    public void Check(Sculpture sculpture) => Euros += 2 * sculpture.Kg;
    public void Check(Manuscript manuscript) => Euros += 60;
}

public class CustomsLines : ILoanCheck
{
    public List<string> Lines { get; } = new();

    public void Check(Painting painting) => Lines.Add($"{painting.Title}: painting, {painting.Width} x {painting.Height} cm");
    public void Check(Sculpture sculpture) => Lines.Add($"{sculpture.Title}: sculpture, {sculpture.Kg} kg");
    public void Check(Manuscript manuscript) => Lines.Add($"{manuscript.Title}: manuscript, {manuscript.Pages} pages");
}

public class Loan(List<IExhibit> exhibits)
{
    public int ShippingCost()
    {
        var costs = new CrateCosts();
        foreach (var exhibit in exhibits) exhibit.SubmitTo(costs);
        return costs.Euros;
    }

    public List<string> CustomsList()
    {
        var lines = new CustomsLines();
        foreach (var exhibit in exhibits) exhibit.SubmitTo(lines);
        return lines.Lines;
    }
}
