using System.Diagnostics.CodeAnalysis;
using System.Globalization;

namespace DesignPatterns.Checks;

public static class Expect
{
    public static void That(bool condition, string reason = "isFalse", object? args = null)
    {
        if (!condition) Fail(reason, args);
    }

    public static void Equal<T>(T expected, T actual)
    {
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
            Fail("notEqual", new { expected, actual });
    }

    public static void Same(object? a, object? b)
    {
        if (!ReferenceEquals(a, b)) Fail("notSame");
    }

    public static void NotSame(object? a, object? b)
    {
        if (ReferenceEquals(a, b)) Fail("same");
    }

    public static TException Throws<TException>(Action action) where TException : Exception
    {
        var expected = typeof(TException).FullName ?? typeof(TException).Name;
        try { action(); }
        catch (Exception e)
        {
            if (e is TException ok) return ok;
            Fail("wrongException", new { expected, actual = e.GetType().FullName ?? e.GetType().Name });
        }
        Fail("didNotThrow", new { expected });
        return null!; // unreachable
    }

    [DoesNotReturn]
    public static void Fail(string reason, object? args = null) =>
        throw new CheckFailedException(reason, ToArgs(args));

    private static Dictionary<string, string> ToArgs(object? args)
    {
        var result = new Dictionary<string, string>();
        if (args is null) return result;
        foreach (var p in args.GetType().GetProperties())
        {
            if (p.GetIndexParameters().Length != 0) continue;
            result[p.Name] = Convert.ToString(p.GetValue(args), CultureInfo.InvariantCulture) ?? "null";
        }
        return result;
    }
}
