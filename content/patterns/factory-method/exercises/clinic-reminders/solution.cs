List<string> patients = ["Ana", "Radu"];

ReminderRound round = new SmsRound();
foreach (var line in round.SendAll(patients, "Monday"))
    Console.WriteLine(line);

round = new LetterRound();
foreach (var line in round.SendAll(patients, "Monday"))
    Console.WriteLine(line);

public interface IReminder
{
    string Write(string patient, string day);
}

public class SmsReminder : IReminder
{
    public string Write(string patient, string day) => $"SMS to {patient}: dentist on {day}";
}

public class LetterReminder : IReminder
{
    public string Write(string patient, string day) => $"Dear {patient}, your appointment is on {day}.";
}

public abstract class ReminderRound
{
    // Each round decides how its reminders are sent.
    protected abstract IReminder NewReminder();

    public List<string> SendAll(List<string> patients, string day)
    {
        var lines = new List<string>();
        foreach (var patient in patients)
            lines.Add(NewReminder().Write(patient, day));
        lines.Add($"{patients.Count} reminders sent");
        return lines;
    }
}

public class SmsRound : ReminderRound
{
    protected override IReminder NewReminder() => new SmsReminder();
}

public class LetterRound : ReminderRound
{
    protected override IReminder NewReminder() => new LetterReminder();
}
