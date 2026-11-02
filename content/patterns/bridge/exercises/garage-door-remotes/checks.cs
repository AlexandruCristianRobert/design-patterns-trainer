using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class GarageDoorChecks
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
    static void NamesNoMotorClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesMotor", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    [Check("motors-move-the-door")]
    static void MotorsMoveTheDoor()
    {
        var chain = $"{new ChainMotor().Raise(200)} / {new ChainMotor().Lower(20)}";
        var belt = $"{new BeltMotor().Raise(200)} / {new BeltMotor().Lower(20)}";

        Expect.That(chain == "chain up 200 cm / chain down 20 cm", "wrongChain", new { actual = chain });
        Expect.That(belt == "quiet belt up 200 cm / quiet belt down 20 cm", "wrongBelt", new { actual = belt });
    }

    [Check("press-opens-and-closes-on-every-motor")]
    static void PressOpensAndClosesOnEveryMotor()
    {
        (string Remote, string Motor, Remote Made, string Up, string Down)[] pairs =
        [
            ("basic remote", "chain motor", new BasicRemote(new ChainMotor()), "chain up 200 cm", "chain down 200 cm"),
            ("basic remote", "belt motor", new BasicRemote(new BeltMotor()), "quiet belt up 200 cm", "quiet belt down 200 cm"),
            ("smart remote", "chain motor", new SmartRemote(new ChainMotor()), "chain up 200 cm", "chain down 200 cm"),
            ("smart remote", "belt motor", new SmartRemote(new BeltMotor()), "quiet belt up 200 cm", "quiet belt down 200 cm"),
        ];
        foreach (var (remote, motor, made, up, down) in pairs)
        {
            var closed = made.Height;
            var first = made.Press();
            var open = made.Height;
            var second = made.Press();

            Expect.That(closed == 0, "notClosedAtFirst", new { remote, motor, actual = closed });
            Expect.That(first == up && open == 200, "wrongOpen", new { remote, motor, actual = first, height = open, expected = up });
            Expect.That(second == down && made.Height == 0, "wrongClose", new { remote, motor, actual = second, height = made.Height, expected = down });
        }
    }

    [Check("vent-opens-a-gap")]
    static void VentOpensAGap()
    {
        var chain = new SmartRemote(new ChainMotor());
        var vent = chain.Vent();
        var gap = chain.Height;
        var again = chain.Vent();
        var stillGap = chain.Height;
        var closing = chain.Press();

        Expect.That(vent == "chain up 20 cm" && gap == 20, "wrongVent", new { actual = vent, height = gap });
        Expect.That(again == "already open" && stillGap == 20, "ventWhenOpen", new { actual = again, height = stillGap });
        Expect.That(closing == "chain down 20 cm" && chain.Height == 0, "wrongCloseFromGap", new { actual = closing, height = chain.Height });

        var belt = new SmartRemote(new BeltMotor());
        belt.Press();
        var whenOpen = belt.Vent();
        Expect.That(whenOpen == "already open" && belt.Height == 200, "ventWhenOpen", new { actual = whenOpen, height = belt.Height });
    }

    [Check("remotes-hold-a-motor")]
    static void RemotesHoldAMotor()
    {
        var motor = typeof(DoorMotor);
        Expect.That(motor.IsInterface || motor.IsAbstract, "motorNotAbstract");
        foreach (var remote in new[] { typeof(BasicRemote), typeof(SmartRemote) })
        {
            Expect.That(typeof(Remote).IsAssignableFrom(remote), "notARemote", new { type = remote.Name });
            Expect.That(Keeps(remote, motor), "holdsNoMotor", new { type = remote.Name });
        }
        NamesNoMotorClass(typeof(Remote), motor);
    }
}
