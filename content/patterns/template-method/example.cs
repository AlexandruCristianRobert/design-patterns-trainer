// The base class fixes the order of a renewal. Each subclass fills in only the steps that differ.
var junior = new JuniorRenewal();
var senior = new SeniorRenewal();
Console.WriteLine(junior.Renew("Mia", 14));
Console.WriteLine(senior.Renew("Tomas", 67));
Console.WriteLine(junior.Renew("Ola", 19));

public abstract class MembershipRenewal
{
    // The template method: not virtual, so no subclass can change the order.
    public string Renew(string member, int age)
    {
        if (!IsEligible(age)) return $"{member}: not eligible at {age}";
        var fee = WorkOutFee(age);
        var receipt = Charge(member, fee);
        var card = IssueCard();
        return $"{receipt}, {card}{WelcomeNote(member)}";
    }

    protected abstract bool IsEligible(int age);
    protected abstract int WorkOutFee(int age);

    // A hook: an optional step with a default that does nothing.
    protected virtual string WelcomeNote(string member) => "";

    private string Charge(string member, int fee) => $"{member} charged {fee} EUR";
    private string IssueCard() => "card issued";
}

public class JuniorRenewal : MembershipRenewal
{
    protected override bool IsEligible(int age) => age < 18;
    protected override int WorkOutFee(int age) => age < 12 ? 20 : 30;
}

public class SeniorRenewal : MembershipRenewal
{
    protected override bool IsEligible(int age) => age >= 60;
    protected override int WorkOutFee(int age) => 40;
}
