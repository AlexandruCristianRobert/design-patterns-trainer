using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace DesignPatterns.Core.Contracts;

public static class ContractVerifier
{
    public static IReadOnlyList<ContractViolation> Verify(CSharpCompilation compilation, Contract contract)
    {
        var sourceTypes = new List<INamedTypeSymbol>();
        Collect(compilation.Assembly.GlobalNamespace, sourceTypes);

        var violations = new List<ContractViolation>();
        foreach (var ct in contract.Types)
        {
            var matches = sourceTypes.Where(t => t.Name == ct.Name).ToList();
            if (matches.Count == 0)
            {
                violations.Add(new(ContractViolationCode.MissingType, ct.Name));
                continue;
            }
            var symbol = matches.FirstOrDefault(t => KindMatches(t, ct.Kind));
            if (symbol is null)
            {
                violations.Add(new(ContractViolationCode.WrongKind, ct.Name));
                continue;
            }
            foreach (var member in ct.Members)
                if (!HasMember(symbol, member))
                    violations.Add(new(ContractViolationCode.MissingMember, ct.Name, member));
        }
        return violations;
    }

    private static void Collect(INamespaceSymbol ns, List<INamedTypeSymbol> into)
    {
        foreach (var t in ns.GetTypeMembers())
            if (t.DeclaredAccessibility == Accessibility.Public && t.Locations.Any(l => l.IsInSource))
                into.Add(t);
        foreach (var child in ns.GetNamespaceMembers()) Collect(child, into);
    }

    private static bool KindMatches(INamedTypeSymbol t, ContractTypeKind kind) => kind switch
    {
        ContractTypeKind.Interface => t.TypeKind == TypeKind.Interface,
        ContractTypeKind.AbstractClass => t.TypeKind == TypeKind.Class && t.IsAbstract,
        ContractTypeKind.Class => t.TypeKind == TypeKind.Class,
        _ => true,
    };

    private static string Norm(string s) => string.Concat(s.Where(c => !char.IsWhiteSpace(c)));

    private static string Display(ITypeSymbol t) =>
        Norm(t.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat));

    private static string Text(TypeSyntax t) => Norm(t.ToString());

    private static bool HasMember(INamedTypeSymbol type, string member)
    {
        var text = member.Trim();
        if (!text.EndsWith(';') && !text.EndsWith('}')) text += ";";
        var decl = SyntaxFactory.ParseMemberDeclaration(text);
        if (decl is null || decl.ContainsDiagnostics)
            throw new ArgumentException($"Unparseable contract member: {member}", nameof(member));

        var isStatic = decl.Modifiers.Any(SyntaxKind.StaticKeyword);
        var members = type.GetMembers();
        // Interface members are implicitly public.
        bool IsPublic(ISymbol s) =>
            s.DeclaredAccessibility == Accessibility.Public || type.TypeKind == TypeKind.Interface;

        switch (decl)
        {
            case MethodDeclarationSyntax m:
                return members.OfType<IMethodSymbol>().Any(s =>
                    s.MethodKind == MethodKind.Ordinary && IsPublic(s) && s.Name == m.Identifier.ValueText &&
                    s.IsStatic == isStatic && Display(s.ReturnType) == Text(m.ReturnType) &&
                    ParamsMatch(s, m.ParameterList));
            case ConstructorDeclarationSyntax c:
                return members.OfType<IMethodSymbol>().Any(s =>
                    s.MethodKind == MethodKind.Constructor && !s.IsStatic && IsPublic(s) &&
                    ParamsMatch(s, c.ParameterList));
            case PropertyDeclarationSyntax p:
                var kinds = p.AccessorList?.Accessors.Select(a => a.Keyword.Kind()).ToList() ?? [];
                var wantGet = kinds.Contains(SyntaxKind.GetKeyword);
                var wantSet = kinds.Contains(SyntaxKind.SetKeyword) || kinds.Contains(SyntaxKind.InitKeyword);
                return members.OfType<IPropertySymbol>().Any(s =>
                    IsPublic(s) && s.Name == p.Identifier.ValueText && s.IsStatic == isStatic &&
                    Display(s.Type) == Text(p.Type) &&
                    (!wantGet || s.GetMethod is { } g && IsPublic(g)) &&
                    (!wantSet || s.SetMethod is { } st && IsPublic(st)));
            default:
                throw new ArgumentException($"Unsupported contract member: {member}", nameof(member));
        }
    }

    private static bool ParamsMatch(IMethodSymbol s, ParameterListSyntax list)
    {
        if (s.Parameters.Length != list.Parameters.Count) return false;
        for (var i = 0; i < s.Parameters.Length; i++)
        {
            var pt = list.Parameters[i].Type;
            if (pt is null || Display(s.Parameters[i].Type) != Text(pt)) return false;
        }
        return true;
    }
}
