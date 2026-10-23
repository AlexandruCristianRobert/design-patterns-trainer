Console.WriteLine(new Reception().Request(2, 18, "Lions"));
Console.WriteLine(new MemberApp().Request(2, 18, "Bears"));
Console.WriteLine(new MemberApp().Request(3, 18, "Bears"));
Console.WriteLine(CourtDiary.Shared.Holder(2, 18));

public sealed class CourtDiary
{
    private static readonly CourtDiary diary;

    static CourtDiary()
    {
        diary = new CourtDiary();
    }

    public static CourtDiary Shared => diary;

    private readonly Dictionary<(int Court, int Hour), string> booked = [];

    private CourtDiary() { }

    public string Book(int court, int hour, string team)
    {
        var slot = $"court {court} at {hour}:00";
        if (booked.TryGetValue((court, hour), out var holder) && holder != team)
            return $"{team}: {slot} taken by {holder}";
        booked[(court, hour)] = team;
        return $"{team}: {slot} booked";
    }

    public string Holder(int court, int hour) => booked.GetValueOrDefault((court, hour), "free");
}

public class Reception
{
    public string Request(int court, int hour, string team) => $"Reception | {CourtDiary.Shared.Book(court, hour, team)}";
}

public class MemberApp
{
    public string Request(int court, int hour, string team) => $"App | {CourtDiary.Shared.Book(court, hour, team)}";
}
