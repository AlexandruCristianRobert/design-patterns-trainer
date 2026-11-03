using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class RobotArmChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // True when `type` or one of its base classes keeps an instance field of type `held`.
    static bool Keeps(Type type, Type held)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            if (t.GetFields(Declared).Any(f => f.FieldType == held)) return true;
        return false;
    }

    // No class that is `top` or derives from it names one of the program's classes that implement or derive from `held`.
    static void NamesNoArmClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesArm", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    [Check("each-arm-uses-its-own-format")]
    static void EachArmUsesItsOwnFormat()
    {
        var karo = $"{new KaroArm().MoveTo(3, 4)} / {new KaroArm().Grip(true)} / {new KaroArm().Grip(false)}";
        var teslin = $"{new TeslinArm().MoveTo(3, 4)} / {new TeslinArm().Grip(true)} / {new TeslinArm().Grip(false)}";

        Expect.That(karo == "KARO GOTO 30 40 / KARO CLAMP / KARO OPEN", "wrongKaro", new { expected = "KARO GOTO 30 40 / KARO CLAMP / KARO OPEN", actual = karo });
        Expect.That(teslin == "teslin.move(3cm, 4cm) / teslin.grip(on) / teslin.grip(off)", "wrongTeslin", new { expected = "teslin.move(3cm, 4cm) / teslin.grip(on) / teslin.grip(off)", actual = teslin });
    }

    [Check("pick-and-place-on-both-arms")]
    static void PickAndPlaceOnBothArms()
    {
        var karo = string.Join(" | ", new PickAndPlace(new KaroArm(), 1, 2, 5, 6).Run());
        var teslin = string.Join(" | ", new PickAndPlace(new TeslinArm(), 1, 2, 5, 6).Run());

        Expect.That(karo == "KARO GOTO 10 20 | KARO CLAMP | KARO GOTO 50 60 | KARO OPEN", "wrongPickAndPlace",
            new { arm = "Karo arm", actual = karo, expected = "KARO GOTO 10 20 | KARO CLAMP | KARO GOTO 50 60 | KARO OPEN" });
        Expect.That(teslin == "teslin.move(1cm, 2cm) | teslin.grip(on) | teslin.move(5cm, 6cm) | teslin.grip(off)", "wrongPickAndPlace",
            new { arm = "Teslin arm", actual = teslin, expected = "teslin.move(1cm, 2cm) | teslin.grip(on) | teslin.move(5cm, 6cm) | teslin.grip(off)" });
    }

    [Check("park-on-both-arms")]
    static void ParkOnBothArms()
    {
        var karo = string.Join(" | ", new Park(new KaroArm()).Run());
        var teslin = string.Join(" | ", new Park(new TeslinArm()).Run());

        Expect.That(karo == "KARO OPEN | KARO GOTO 0 0", "wrongPark", new { arm = "Karo arm", actual = karo, expected = "KARO OPEN | KARO GOTO 0 0" });
        Expect.That(teslin == "teslin.grip(off) | teslin.move(0cm, 0cm)", "wrongPark", new { arm = "Teslin arm", actual = teslin, expected = "teslin.grip(off) | teslin.move(0cm, 0cm)" });
    }

    [Check("jobs-hold-an-arm")]
    static void JobsHoldAnArm()
    {
        var arm = typeof(Arm);
        Expect.That(arm.IsInterface || arm.IsAbstract, "armNotAbstract");
        foreach (var job in new[] { typeof(PickAndPlace), typeof(Park) })
        {
            Expect.That(typeof(Job).IsAssignableFrom(job), "notAJob", new { type = job.Name });
            Expect.That(Keeps(job, arm), "holdsNoArm", new { type = job.Name });
        }
        NamesNoArmClass(typeof(Job), arm);
    }
}
