var design = new Team("Design");
design.Add(new Employee("Ana", 4200));
design.Add(new Employee("Ben", 3900));

var web = new Team("Web");
web.Add(new Employee("Chen", 4800));

var apps = new Team("Apps");
apps.Add(new Employee("Dora", 5600));
apps.Add(design);
apps.Add(web);

IStaff company = apps;
Console.WriteLine($"{company.Headcount()} people, {company.MonthlyCost()} a month");

// What every part of the org chart answers, one person or a whole team. Leave it as it is.
public interface IStaff
{
    int Headcount();
    int MonthlyCost();
}

// One person and their monthly salary. Leave it as it is.
public class Employee(string name, int salary) : IStaff
{
    public string Name => name;
    public int Headcount() => 1;
    public int MonthlyCost() => salary;
}

// The composite: a team holds people and other teams, all as IStaff.
public class Team(string name) : IStaff
{
    private readonly List<IStaff> members = [];

    public string Name => name;

    public void Add(IStaff member) => members.Add(member);

    // Asks every member, person or team, and adds up the answers.
    public int Headcount() => members.Sum(m => m.Headcount());

    public int MonthlyCost() => members.Sum(m => m.MonthlyCost());
}
