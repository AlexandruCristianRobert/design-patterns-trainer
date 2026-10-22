using DesignPatterns.Core.Compilation;

namespace DesignPatterns.Core.Tests;

public static class TestCompile
{
    public static byte[] Bytes(string user, string? checks = null)
    {
        var outcome = CSharpCompiler.Build(user, checks);
        Assert.True(outcome.Success,
            string.Join(Environment.NewLine, outcome.Diagnostics.Select(d =>
                $"{d.File} {d.Id} ({d.StartLine},{d.StartColumn}): {d.Message}")));
        return outcome.Assembly!;
    }
}
