using System.Reflection;
using DesignPatterns.Checks;

static class OrgChartChecks
{
    // A contractor the program has never seen: one more kind of IStaff.
    sealed class Contractor(int people, int cost) : IStaff
    {
        public int Headcount() => people;
        public int MonthlyCost() => cost;
    }

    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // Three levels: Apps holds Dora and Design; Design holds Ana and Mobile; Mobile holds Eli and Fay.
    static Team ThreeLevels()
    {
        var mobile = new Team("Mobile");
        mobile.Add(new Employee("Eli", 4000));
        mobile.Add(new Employee("Fay", 4500));
        var design = new Team("Design");
        design.Add(new Employee("Ana", 4200));
        design.Add(mobile);
        var apps = new Team("Apps");
        apps.Add(new Employee("Dora", 5600));
        apps.Add(design);
        return apps;
    }

    // Every type found inside t: t itself, its element type and its generic arguments, all the way down.
    static IEnumerable<Type> Inside(Type t) =>
        new[] { t }.Concat(t.HasElementType ? Inside(t.GetElementType()!) : [])
                   .Concat(t.IsGenericType ? t.GetGenericArguments().SelectMany(Inside) : []);

    [Check("team-counts-everyone")]
    static void TeamCountsEveryone()
    {
        IStaff apps = ThreeLevels();
        var single = new Team("Solo");
        single.Add(new Employee("Gus", 3000));

        Expect.That(((IStaff)single).Headcount() == 1, "wrongSingle", new { actual = ((IStaff)single).Headcount() });
        Expect.That(apps.Headcount() == 4, "wrongNested", new { actual = apps.Headcount() });
    }

    [Check("team-adds-up-costs")]
    static void TeamAddsUpCosts()
    {
        IStaff apps = ThreeLevels();
        var single = new Team("Solo");
        single.Add(new Employee("Gus", 3000));

        Expect.That(((IStaff)single).MonthlyCost() == 3000, "wrongSingle", new { actual = ((IStaff)single).MonthlyCost() });
        Expect.That(apps.MonthlyCost() == 18300, "wrongNested", new { actual = apps.MonthlyCost() });
    }

    [Check("empty-team-is-zero")]
    static void EmptyTeamIsZero()
    {
        IStaff empty = new Team("New hires");
        var apps = ThreeLevels();
        apps.Add(new Team("Interns"));

        Expect.That(empty.Headcount() == 0 && empty.MonthlyCost() == 0, "emptyNotZero", new { people = empty.Headcount(), cost = empty.MonthlyCost() });
        Expect.That(((IStaff)apps).Headcount() == 4 && ((IStaff)apps).MonthlyCost() == 18300, "emptyChangedTotals",
            new { people = ((IStaff)apps).Headcount(), cost = ((IStaff)apps).MonthlyCost() });
    }

    [Check("totals-are-asked-for-each-time")]
    static void TotalsAreAskedForEachTime()
    {
        var apps = ThreeLevels();
        var before = ((IStaff)apps).Headcount();
        apps.Add(new Contractor(3, 9000));
        var people = ((IStaff)apps).Headcount();
        var cost = ((IStaff)apps).MonthlyCost();

        Expect.That(before == 4 && people == 7 && cost == 27300, "missedNewMember", new { people, cost });
    }

    [Check("team-keeps-istaff-members")]
    static void TeamKeepsIStaffMembers()
    {
        Expect.That(typeof(IStaff).IsAssignableFrom(typeof(Team)), "teamNotStaff");
        var fields = typeof(Team).GetFields(Declared);
        Expect.That(fields.Any(f => Inside(f.FieldType).Contains(typeof(IStaff))), "noStaffField");
        var named = fields.SelectMany(f => Inside(f.FieldType)).FirstOrDefault(t => t == typeof(Employee));
        Expect.That(named is null, "employeeField");
    }
}
