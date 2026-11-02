// A valid build: the steps come in any order and are checked at Build().
var seated = new BookingBuilder("Cluj", "Brasov")
    .WithMeal()
    .WithCarriage("bike")
    .WithBike()
    .Build();
Console.WriteLine($"Built: {seated.Describe()}");

// An invalid build: a bike needs a carriage with bike spaces.
try
{
    new BookingBuilder("Cluj", "Brasov").WithBike().Build();
}
catch (InvalidOperationException problem)
{
    Console.WriteLine($"Rejected: {problem.Message}");
}

// A reusable recipe: the planner knows the steps, the builder does the work.
var commuter = TripPlanner.CommuterReturn(new BookingBuilder("Cluj", "Brasov")).Build();
Console.WriteLine($"Recipe: {commuter.Describe()}");

// The finished product: read-only, so nothing changes it after Build().
public record Booking(string From, string To, int? Seat, string Carriage, bool Bike, bool Meal)
{
    public string Describe() =>
        $"{From} to {To}, {Carriage} carriage, seat {Seat?.ToString() ?? "any"}, bike {(Bike ? "yes" : "no")}, meal {(Meal ? "yes" : "no")}";
}

// Collects the choices step by step, then checks the whole at Build().
public class BookingBuilder
{
    private readonly string from;
    private readonly string to;
    private int? seat;
    private string carriage = "standard";
    private bool bike;
    private bool meal;

    public BookingBuilder(string from, string to)
    {
        this.from = from;
        this.to = to;
    }

    public BookingBuilder WithSeat(int number) { seat = number; return this; }
    public BookingBuilder WithCarriage(string kind) { carriage = kind; return this; }
    public BookingBuilder WithBike() { bike = true; return this; }
    public BookingBuilder WithMeal() { meal = true; return this; }

    public Booking Build()
    {
        if (bike && carriage != "bike")
            throw new InvalidOperationException("A bike needs a carriage with bike spaces.");
        return new Booking(from, to, seat, carriage, bike, meal);
    }
}

// A recipe that is reused: the same steps, whichever builder it is given.
public static class TripPlanner
{
    public static BookingBuilder CommuterReturn(BookingBuilder builder) =>
        builder.WithSeat(12).WithMeal();
}
