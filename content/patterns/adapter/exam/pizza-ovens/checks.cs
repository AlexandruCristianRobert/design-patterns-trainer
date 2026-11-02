using System.Reflection;
using DesignPatterns.Checks;

static class OvenChecks
{
    // A new FornoOven and the panel it controls. FornoOven is either created with a FornoPanel,
    // or derives from FornoPanel and has a parameterless constructor; both are accepted.
    static (IOven Oven, FornoPanel Panel) NewOven()
    {
        var type = typeof(FornoOven);
        if (!typeof(IOven).IsAssignableFrom(type)) Expect.Fail("notAnOven");

        var withPanel = type.GetConstructor([typeof(FornoPanel)]);
        if (withPanel is not null)
        {
            var panel = new FornoPanel();
            return ((IOven)withPanel.Invoke([panel]), panel);
        }

        var plain = type.GetConstructor(Type.EmptyTypes);
        if (plain is not null && typeof(FornoPanel).IsAssignableFrom(type))
        {
            var oven = plain.Invoke(null);
            return ((IOven)oven, (FornoPanel)oven);
        }

        Expect.Fail("noOvenConstructor");
        return default;
    }

    [Check("panel-keeps-power-and-dial")]
    static void PanelKeepsPowerAndDial()
    {
        var panel = new FornoPanel();
        var (offAtFirst, dialAtFirst) = (!panel.IsOn, panel.Dial);
        panel.SetDial(450);
        var dialWhileOff = panel.Dial;
        panel.Power(true);
        var on = panel.IsOn;
        panel.Power(false);

        Expect.That(offAtFirst && dialAtFirst == 0, "newPanelNotOff", new { on = !offAtFirst, dial = dialAtFirst });
        Expect.That(dialWhileOff == 450, "dialNotKept", new { dial = dialWhileOff });
        Expect.That(on && !panel.IsOn, "powerIgnored");
    }

    [Check("heat-sets-the-dial")]
    static void HeatSetsTheDial()
    {
        var (oven, panel) = NewOven();
        oven.Heat(220);
        var first = (panel.IsOn, panel.Dial);
        oven.Heat(37);
        var second = panel.Dial;

        Expect.That(first.IsOn, "panelNotOn");
        Expect.That(first.Dial == 428, "wrongDial", new { celsius = 220, dial = first.Dial, expected = 428 });
        Expect.That(second == 99, "wrongDial", new { celsius = 37, dial = second, expected = 99 });
    }

    [Check("reading-comes-from-the-panel")]
    static void ReadingComesFromThePanel()
    {
        var (oven, panel) = NewOven();
        panel.Power(true);
        panel.SetDial(500);
        var turned = oven.Celsius();
        panel.SetDial(99);
        var low = oven.Celsius();
        oven.Heat(250);
        var heated = oven.Celsius();

        Expect.That(turned == 260, "wrongReading", new { dial = 500, actual = turned, expected = 260 });
        Expect.That(low == 37, "wrongReading", new { dial = 99, actual = low, expected = 37 });
        Expect.That(heated == 250, "wrongAfterHeat", new { actual = heated });
    }

    [Check("off-turns-the-panel-off")]
    static void OffTurnsThePanelOff()
    {
        var (oven, panel) = NewOven();
        var cold = oven.Celsius();
        oven.Heat(250);
        oven.Off();

        Expect.That(cold == 0, "coldOvenReads", new { actual = cold });
        Expect.That(!panel.IsOn, "panelStillOn");
        Expect.That(oven.Celsius() == 0, "offOvenReads", new { actual = oven.Celsius() });
    }

    [Check("oven-fits-the-kitchen")]
    static void OvenFitsTheKitchen()
    {
        Expect.That(typeof(IOven).IsAssignableFrom(typeof(FornoOven)), "notAnOven");
        Expect.That(!typeof(IOven).IsAssignableFrom(typeof(FornoPanel)), "panelChanged");
        var type = typeof(FornoOven);
        var created = type.GetConstructor([typeof(FornoPanel)]) is not null ||
            (typeof(FornoPanel).IsAssignableFrom(type) && type.GetConstructor(Type.EmptyTypes) is not null);
        Expect.That(created, "noOvenConstructor");
    }
}
