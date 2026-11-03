// The widgets know only the form. A widget says "I changed", and the form decides who reacts.
var form = new TicketForm();
form.Film.Pick("Dune");
Console.WriteLine($"showtimes: {string.Join(", ", form.Showtime.Options)}");
form.Showtime.Pick("20:00");
Console.WriteLine($"free seats: {form.Seats.Free}");
form.Seats.Pick(2);
Console.WriteLine($"price: {form.Price.Text}");
form.Student.Set(true);
Console.WriteLine($"student price: {form.Price.Text}");

public interface ITicketForm
{
    void Changed(object widget);
}

public class FilmPicker(ITicketForm form)
{
    public string? Title { get; private set; }

    public void Pick(string title)
    {
        Title = title;
        form.Changed(this);
    }
}

public class ShowtimePicker(ITicketForm form)
{
    public IReadOnlyList<string> Options { get; private set; } = [];
    public string? Time { get; private set; }

    public void Offer(IReadOnlyList<string> times)
    {
        Options = times;
        Time = null;
    }

    public void Pick(string time)
    {
        Time = time;
        form.Changed(this);
    }
}

public class SeatPicker(ITicketForm form)
{
    public int Free { get; private set; }
    public int Count { get; private set; }

    public void SetFree(int free)
    {
        Free = free;
        Count = 0;
    }

    public void Pick(int count)
    {
        Count = count;
        form.Changed(this);
    }
}

public class StudentBox(ITicketForm form)
{
    public bool IsOn { get; private set; }

    public void Set(bool on)
    {
        IsOn = on;
        form.Changed(this);
    }
}

public class PriceLabel
{
    public string Text { get; private set; } = "0 EUR";

    public void Show(int euros) => Text = $"{euros} EUR";
}

public class TicketForm : ITicketForm
{
    public FilmPicker Film { get; }
    public ShowtimePicker Showtime { get; }
    public SeatPicker Seats { get; }
    public StudentBox Student { get; }
    public PriceLabel Price { get; } = new();

    public TicketForm()
    {
        Film = new(this);
        Showtime = new(this);
        Seats = new(this);
        Student = new(this);
    }

    public void Changed(object widget)
    {
        if (widget == Film)
        {
            Showtime.Offer(Film.Title == "Dune" ? ["18:00", "20:00"] : ["15:00"]);
            Seats.SetFree(0);
        }
        else if (widget == Showtime)
        {
            Seats.SetFree(Showtime.Time == "20:00" ? 6 : 10);
        }
        Price.Show(Seats.Count * (Student.IsOn ? 7 : 10));
    }
}
