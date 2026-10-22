namespace DesignPatterns.Content.Tests;

public class CheckReasonScannerTests
{
    [Fact] public void HandlesNamedReason_AndQualifiedExpect()
    {
        var map = CheckReasonScanner.CustomReasonsByCheck("""
            static class C {
                [Check("a")] static void A() { DesignPatterns.Checks.Expect.That(true, reason: "named"); DesignPatterns.Checks.Expect.Fail(reason: "failNamed"); }
            }
            """);
        Assert.Equal(new[] { "failNamed", "named" }, map["a"].OrderBy(x => x));
    }

    [Fact] public void CollectsCustomReasons_PerCheck()
    {
        var map = CheckReasonScanner.CustomReasonsByCheck("""
            using DesignPatterns.Checks;
            static class C {
                [Check("a")] static void A() { Expect.Fail("didNotNotify", new { o = 1 }); Expect.That(true, "usesIf"); Expect.That(true); }
                [Check("b")] static void B() { Expect.That(true, "isFalse"); Expect.Fail("threw"); Expect.Equal(1, 1); }
            }
            """);
        Assert.Equal(new[] { "didNotNotify", "usesIf" }, map["a"].OrderBy(x => x));
        Assert.Empty(map["b"]);
    }
}
