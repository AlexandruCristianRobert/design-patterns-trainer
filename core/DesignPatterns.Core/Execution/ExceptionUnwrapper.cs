using System.Reflection;

namespace DesignPatterns.Core.Execution;

public sealed record ExceptionInfo(string Type, string Message);

public static class ExceptionUnwrapper
{
    public static ExceptionInfo Unwrap(Exception exception)
    {
        var current = exception;
        while (true)
        {
            var inner = current switch
            {
                TargetInvocationException { InnerException: { } i } => i,
                TypeInitializationException { InnerException: { } i } => i,
                AggregateException { InnerExceptions: [var single] } => single,
                _ => null,
            };
            if (inner is null) break;
            current = inner;
        }
        return new ExceptionInfo(current.GetType().FullName ?? current.GetType().Name, current.Message);
    }
}
