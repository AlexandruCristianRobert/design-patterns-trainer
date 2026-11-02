var panel = new FornoPanel();
IOven oven = new FornoOven(panel);

oven.Heat(250);
Console.WriteLine($"heat 250 °C: dial at {panel.Dial} °F, oven reads {oven.Celsius()} °C");

// The cook turns the dial on the panel itself.
panel.SetDial(500);
Console.WriteLine($"dial at 500 °F: oven reads {oven.Celsius()} °C");

oven.Off();
Console.WriteLine($"off: panel on = {panel.IsOn}, oven reads {oven.Celsius()} °C");

// What the kitchen software was written against. Temperatures are in °C.
public interface IOven
{
    void Heat(int celsius);
    void Off();
    int Celsius();
}

// Plays the part of the oven maker's control panel, which works in °F.
public class FornoPanel
{
    public bool IsOn { get; private set; }
    public int Dial { get; private set; }

    public void Power(bool on) => IsOn = on;
    public void SetDial(int fahrenheit) => Dial = fahrenheit;
}

// Lets the kitchen software run the new oven through its panel, converting °C and °F both ways.
public class FornoOven(FornoPanel panel) : IOven
{
    public void Heat(int celsius)
    {
        panel.Power(true);
        panel.SetDial((int)Math.Round(celsius * 9 / 5.0 + 32));
    }

    public void Off() => panel.Power(false);

    public int Celsius() => panel.IsOn ? (int)Math.Round((panel.Dial - 32) * 5 / 9.0) : 0;
}
