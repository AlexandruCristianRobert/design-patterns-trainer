using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class VacuumModeChecks
{
    // Hands a new mode to the vacuum through whichever public settable property or one-argument method takes a CleaningMode.
    static void GiveMode(object vacuum, object mode)
    {
        var modeType = Code.Type("CleaningMode").Clr;
        var type = vacuum.GetType();
        var property = type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(p => p.PropertyType == modeType && p.SetMethod is { IsPublic: true });
        if (property is not null)
        {
            property.SetValue(vacuum, mode);
            return;
        }
        var method = type.GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(m => !m.IsSpecialName && m.GetParameters() is [var p] && p.ParameterType == modeType);
        if (method is null) Expect.Fail("noWayToChange");
        method.Invoke(vacuum, [mode]);
    }

    [Check("each-mode-times-the-room")]
    static void EachModeTimesTheRoom()
    {
        var quiet = new RobotVacuum(new QuietMode()).Clean(10);
        var turbo = new RobotVacuum(new TurboMode()).Clean(10);
        var spot = new RobotVacuum(new SpotMode()).Clean(40);

        Expect.That(quiet == 30, "wrongQuiet", new { minutes = quiet });
        Expect.That(turbo == 10, "wrongTurbo", new { minutes = turbo });
        Expect.That(spot == 5, "wrongSpot", new { minutes = spot });
    }

    [Check("mode-kept-until-owner-changes-it")]
    static void ModeKeptUntilOwnerChangesIt()
    {
        var vacuum = new RobotVacuum(new TurboMode());
        int[] rooms = [50, 80, 120, 1, 200];
        var minutes = rooms.Select(vacuum.Clean).ToList();

        Expect.That(minutes.SequenceEqual(rooms), "modeChangedByItself", new { actual = string.Join(", ", minutes) });
    }

    [Check("owner-can-change-mode")]
    static void OwnerCanChangeMode()
    {
        var vacuum = new RobotVacuum(new QuietMode());
        var first = vacuum.Clean(10);

        GiveMode(vacuum, new SpotMode());
        var second = vacuum.Clean(10);

        Expect.That(first == 30, "wrongQuiet", new { minutes = first });
        Expect.That(second == 5, "changeIgnored", new { minutes = second });
        Expect.That(vacuum.TotalMinutes == 35, "wrongTotal", new { total = vacuum.TotalMinutes });
    }

    [Check("vacuum-knows-no-particular-mode")]
    static void VacuumKnowsNoParticularMode()
    {
        var modeType = Code.Type("CleaningMode").Clr;
        var concrete = modeType.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && modeType.IsAssignableFrom(t) && t.DeclaringType != typeof(VacuumModeChecks))
            .Select(t => t.Name).Append("GetType").ToHashSet();

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "RobotVacuum"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "vacuumNamesMode", new { type = named });
        }
    }
}
