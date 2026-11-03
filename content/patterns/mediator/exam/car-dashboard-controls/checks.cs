using System.Reflection;
using DesignPatterns.Checks;

static class CarDashboardChecks
{
    // Everything the controls show at once, such as "gear D, cruise on at 110, camera off, radio on".
    static string Now(Dashboard car) =>
        $"gear {car.Gear.Position}, cruise {(car.Cruise.IsOn ? $"on at {car.Cruise.Speed}" : $"off at {car.Cruise.Speed}")}, " +
        $"camera {(car.Camera.IsShowing ? "on" : "off")}, radio {(car.Radio.IsMuted ? "muted" : "on")}";

    static void Step(Dashboard car, Action action, string said, string expected)
    {
        action();
        var actual = Now(car);
        Expect.That(actual == expected, "wrongControls", new { step = said, expected, actual });
    }

    [Check("cruise-control-works-only-in-drive")]
    static void CruiseControlWorksOnlyInDrive()
    {
        var car = new Dashboard();
        var start = Now(car);
        Expect.That(start == "gear P, cruise off at 0, camera off, radio on", "wrongStart",
            new { expected = "gear P, cruise off at 0, camera off, radio on", actual = start });

        Step(car, () => car.Cruise.Set(100), "setting cruise control to 100 in P", "gear P, cruise off at 0, camera off, radio on");
        Step(car, () => car.Gear.Select("D"), "selecting D", "gear D, cruise off at 0, camera off, radio on");
        Step(car, () => car.Cruise.Set(100), "setting cruise control to 100 in D", "gear D, cruise on at 100, camera off, radio on");
        Step(car, () => car.Cruise.Set(90), "setting it to 90", "gear D, cruise on at 90, camera off, radio on");
        Step(car, () => car.Cruise.Off(), "turning cruise control off", "gear D, cruise off at 0, camera off, radio on");
        Step(car, () => car.Cruise.Set(80), "setting it to 80", "gear D, cruise on at 80, camera off, radio on");
        Step(car, () => car.Gear.Select("N"), "selecting N", "gear N, cruise off at 0, camera off, radio on");
        Step(car, () => car.Cruise.Set(80), "setting cruise control to 80 in N", "gear N, cruise off at 0, camera off, radio on");
    }

    [Check("the-brake-turns-cruise-control-off")]
    static void TheBrakeTurnsCruiseControlOff()
    {
        var car = new Dashboard();
        Step(car, () => car.Brake.Press(), "pressing the brake in P", "gear P, cruise off at 0, camera off, radio on");
        car.Gear.Select("D");
        car.Cruise.Set(120);
        Step(car, () => car.Brake.Press(), "pressing the brake with cruise control at 120", "gear D, cruise off at 0, camera off, radio on");
        Step(car, () => car.Brake.Press(), "pressing the brake again", "gear D, cruise off at 0, camera off, radio on");
        Step(car, () => car.Cruise.Set(70), "setting cruise control to 70 after braking", "gear D, cruise on at 70, camera off, radio on");
    }

    [Check("reverse-shows-the-camera-and-mutes-the-radio")]
    static void ReverseShowsTheCameraAndMutesTheRadio()
    {
        var car = new Dashboard();
        car.Gear.Select("D");
        car.Cruise.Set(50);
        Step(car, () => car.Gear.Select("R"), "selecting R with cruise control on", "gear R, cruise off at 0, camera on, radio muted");
        Step(car, () => car.Cruise.Set(50), "setting cruise control in R", "gear R, cruise off at 0, camera on, radio muted");
        Step(car, () => car.Brake.Press(), "pressing the brake in R", "gear R, cruise off at 0, camera on, radio muted");
        Step(car, () => car.Gear.Select("N"), "selecting N after R", "gear N, cruise off at 0, camera off, radio on");
        Step(car, () => car.Gear.Select("R"), "selecting R again", "gear R, cruise off at 0, camera on, radio muted");
        Step(car, () => car.Gear.Select("D"), "selecting D after R", "gear D, cruise off at 0, camera off, radio on");
    }

    [Check("the-controls-know-only-the-dashboard")]
    static void TheControlsKnowOnlyTheDashboard() =>
        ExpectNoneHoldsAnother([typeof(CruiseControl), typeof(BrakePedal), typeof(GearLever), typeof(ReversingCamera), typeof(Radio)]);

    // ---- No part holds another ----

    const BindingFlags AnyField =
        BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // No field of a part, or of a class it inherits from, can hold one of the parts: typed as the part, as a class or
    // interface of ours that the part is, or as an array, list or other collection of them. Fields typed object and
    // delegates do not count.
    static void ExpectNoneHoldsAnother(Type[] parts)
    {
        foreach (var part in parts)
            for (var type = part; type is not null && type != typeof(object); type = type.BaseType)
                foreach (var field in type.GetFields(AnyField))
                    foreach (var other in parts)
                        Expect.That(!Holds(field.FieldType, other), "holdsAnother",
                            new { type = part.Name, field = Shown(field), other = other.Name });
    }

    static bool Holds(Type fieldType, Type part) =>
        fieldType != typeof(object) && !typeof(Delegate).IsAssignableFrom(fieldType)
        && (part.IsAssignableFrom(fieldType)
            || fieldType.Assembly == part.Assembly && fieldType.IsAssignableFrom(part)
            || fieldType.HasElementType && Holds(fieldType.GetElementType()!, part)
            || fieldType.IsGenericType && fieldType.GetGenericArguments().Any(a => Holds(a, part)));

    // The field's name as written: "<Dashboard>k__BackingField" becomes "Dashboard".
    static string Shown(FieldInfo field) =>
        field.Name.StartsWith('<') && field.Name.IndexOf('>') > 1 ? field.Name[1..field.Name.IndexOf('>')] : field.Name;
}
