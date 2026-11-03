using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class RumbleChecks
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
    static void NamesNoControllerClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesController", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    [Check("controllers-buzz-their-own-way")]
    static void ControllersBuzzTheirOwnWay()
    {
        var pad = $"{new Gamepad().Buzz(300, 80)} / {new Gamepad().Wait(200)}";
        var phone = $"{new Phone().Buzz(300, 80)} / {new Phone().Wait(200)}";

        Expect.That(pad == "pad rumble 80% 300 ms / pad wait 200 ms", "wrongGamepad", new { expected = "pad rumble 80% 300 ms / pad wait 200 ms", actual = pad });
        Expect.That(phone == "phone vibrate 300 ms / phone pause 200 ms", "wrongPhone", new { expected = "phone vibrate 300 ms / phone pause 200 ms", actual = phone });
    }

    [Check("explosion-on-both-controllers")]
    static void ExplosionOnBothControllers()
    {
        var pad = string.Join(" | ", new Explosion(new Gamepad()).Play());
        var phone = string.Join(" | ", new Explosion(new Phone()).Play());

        Expect.That(pad == "pad rumble 100% 400 ms", "wrongExplosion", new { controller = "gamepad", actual = pad, expected = "pad rumble 100% 400 ms" });
        Expect.That(phone == "phone vibrate 400 ms", "wrongExplosion", new { controller = "phone", actual = phone, expected = "phone vibrate 400 ms" });
    }

    [Check("heartbeat-on-both-controllers")]
    static void HeartbeatOnBothControllers()
    {
        (string Controller, int Beats, string Actual, string Expected)[] cases =
        [
            ("gamepad", 1, string.Join(" | ", new Heartbeat(new Gamepad(), 1).Play()),
                "pad rumble 40% 100 ms | pad wait 150 ms | pad rumble 40% 100 ms"),
            ("phone", 2, string.Join(" | ", new Heartbeat(new Phone(), 2).Play()),
                "phone vibrate 100 ms | phone pause 150 ms | phone vibrate 100 ms | phone pause 600 ms | phone vibrate 100 ms | phone pause 150 ms | phone vibrate 100 ms"),
        ];
        foreach (var (controller, beats, actual, expected) in cases)
            Expect.That(actual == expected, "wrongHeartbeat", new { controller, beats, actual, expected });
    }

    [Check("effects-hold-a-controller")]
    static void EffectsHoldAController()
    {
        var controller = typeof(Controller);
        Expect.That(controller.IsInterface || controller.IsAbstract, "controllerNotAbstract");
        foreach (var effect in new[] { typeof(Explosion), typeof(Heartbeat) })
        {
            Expect.That(typeof(Effect).IsAssignableFrom(effect), "notAnEffect", new { type = effect.Name });
            Expect.That(Keeps(effect, controller), "holdsNoController", new { type = effect.Name });
        }
        NamesNoControllerClass(typeof(Effect), controller);
    }
}
