using DesignPatterns.Core.Execution;

namespace DesignPatterns.Core.Protocol;

public sealed class RunnerService
{
    private LoadedProgram? _program;

    public LoadResponse Load(LoadRequest request)
    {
        _program = LoadedProgram.Load(Convert.FromBase64String(request.AssemblyBase64), request.Source);
        return new LoadResponse(_program.CheckIds, _program.HasEntryPoint);
    }

    public Task<RunOutcome> RunMainAsync() => Current.RunMainAsync();

    public Task<CheckResult> RunCheckAsync(string id) => Current.RunCheckAsync(id);

    private LoadedProgram Current => _program ?? throw new InvalidOperationException("No program loaded.");
}
