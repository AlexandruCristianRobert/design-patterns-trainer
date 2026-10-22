using DesignPatterns.Checks;

static class GreeterChecks
{
    [Check("greets")]
    static void Greets() => Expect.That(new Greeter().Greet() == "Hello", "wrongGreeting");

    [Check("second")]
    static void Second() => Expect.Equal("Hello", new Greeter().Greet());
}
