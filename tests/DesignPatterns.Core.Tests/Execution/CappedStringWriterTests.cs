using DesignPatterns.Core.Execution;

namespace DesignPatterns.Core.Tests.Execution;

public class CappedStringWriterTests
{
    [Fact]
    public void DropsWritesBeyondCapacity()
    {
        var w = new CappedStringWriter(10);
        for (var i = 0; i < 1000; i++) w.Write("abc");
        Assert.Equal(10, w.ToString().Length);
        Assert.True(w.Truncated);
    }

    [Fact]
    public void DoesNotLeaveLoneHighSurrogateAtCap()
    {
        var w = new CappedStringWriter(3);
        w.Write("ab\U0001F600");
        Assert.Equal("ab", w.ToString());
        Assert.True(w.Truncated);
    }

    [Fact]
    public void NotTruncatedWhenWithinCapacity()
    {
        var w = new CappedStringWriter(10);
        w.Write("0123456789");
        Assert.False(w.Truncated);
    }
}
