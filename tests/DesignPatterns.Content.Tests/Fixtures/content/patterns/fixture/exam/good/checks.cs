using DesignPatterns.Checks;

static class CounterChecks
{
    [Check("starts-at-one")]
    static void StartsAtOne() => Expect.Equal(1, new Counter().Next());

    [Check("counts-up")]
    static void CountsUp()
    {
        var c = new Counter();
        c.Next();
        Expect.Equal(2, c.Next());
    }
}
