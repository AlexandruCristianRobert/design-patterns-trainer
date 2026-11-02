foreach (var line in Demo.Run())
    Console.WriteLine(line);

public static class Demo
{
    public static List<string> Run()
    {
        CampLog.Lines.Clear();

        var reception = new ReceptionScreen(new PitchPlanner(), new Barrier(), new WifiVouchers(), new WelcomePacks());
        CampLog.Lines.Add(reception.CheckIn("Ana", "AB-12", 7));

        var online = new OnlineCheckIn(new PitchPlanner(), new Barrier(), new WifiVouchers(), new WelcomePacks());
        CampLog.Lines.Add($"online: {online.Submit("Bo", "CD-34", 2)}");
        CampLog.Lines.Add($"online: {online.Submit("Cy", "EF-56", 20)}");

        return [.. CampLog.Lines];
    }
}

// Collects what happened, in order. Leave as is.
public static class CampLog
{
    public static List<string> Lines { get; } = [];
}

// The campsite's own classes. Each does a single job. Leave them as they are.
public class PitchPlanner
{
    // Lake pitches are for stays of 7 nights or more, Meadow pitches for shorter ones.
    // Stays of 0 nights or more than 14 get no pitch.
    public string? Assign(string guest, int nights)
    {
        if (nights < 1 || nights > 14)
        {
            CampLog.Lines.Add($"no pitch for {guest}");
            return null;
        }
        var pitch = nights >= 7 ? "Lake" : "Meadow";
        CampLog.Lines.Add($"pitch {pitch} for {guest}");
        return pitch;
    }
}

public class Barrier
{
    public void AddPlate(string plate) => CampLog.Lines.Add($"barrier knows {plate}");
}

public class WifiVouchers
{
    public void Issue(string guest, int nights) => CampLog.Lines.Add($"wifi for {guest}, {nights} nights");
}

public class WelcomePacks
{
    public void Print(string guest, string pitch) => CampLog.Lines.Add($"welcome pack for {guest} at {pitch}");
}

// The screen at reception. It knows all four classes and the order they are called in.
public class ReceptionScreen(PitchPlanner pitches, Barrier barrier, WifiVouchers wifi, WelcomePacks packs)
{
    public string CheckIn(string guest, string plate, int nights)
    {
        var pitch = pitches.Assign(guest, nights);
        if (pitch is null)
            return $"Sorry {guest}, no pitch";
        barrier.AddPlate(plate);
        wifi.Issue(guest, nights);
        packs.Print(guest, pitch);
        return $"Welcome {guest}, pitch {pitch}";
    }
}

// The online check-in. It knows the same four classes and repeats the same steps.
public class OnlineCheckIn(PitchPlanner pitches, Barrier barrier, WifiVouchers wifi, WelcomePacks packs)
{
    public bool Submit(string guest, string plate, int nights)
    {
        var pitch = pitches.Assign(guest, nights);
        if (pitch is null)
            return false;
        barrier.AddPlate(plate);
        wifi.Issue(guest, nights);
        packs.Print(guest, pitch);
        return true;
    }
}
