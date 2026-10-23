using DesignPatterns.Checks;

static class BellChecks
{
    [Check("rings")]
    static void Rings()
    {
        var b = new Bell();
        b.Notify();
        Expect.Equal(1, b.Rings());
    }
}
