using DesignPatterns.Core.Compilation;
using DesignPatterns.Core.Contracts;

namespace DesignPatterns.Core.Protocol;

public static class CompilerService
{
    public static CompileResponse Compile(CompileRequest request)
    {
        switch (request.Purpose)
        {
            case CompilePurpose.Diagnostics:
            {
                var o = CSharpCompiler.Analyze(request.Source);
                return new CompileResponse(o.Success, o.Diagnostics, [], null);
            }
            case CompilePurpose.Run:
                return FromBuild(CSharpCompiler.Build(request.Source));
            default:
            {
                var analysis = CSharpCompiler.Analyze(request.Source);
                if (!analysis.Success) return new CompileResponse(false, analysis.Diagnostics, [], null);
                if (request.Contract is { } contract)
                {
                    var violations = ContractVerifier.Verify(analysis.Compilation, contract);
                    if (violations.Count > 0) return new CompileResponse(false, analysis.Diagnostics, violations, null);
                }
                return FromBuild(CSharpCompiler.Build(request.Source, request.ChecksSource));
            }
        }
    }

    private static CompileResponse FromBuild(CompilationOutcome o) =>
        new(o.Success, o.Diagnostics, [], o.Assembly is { } a ? Convert.ToBase64String(a) : null);
}
