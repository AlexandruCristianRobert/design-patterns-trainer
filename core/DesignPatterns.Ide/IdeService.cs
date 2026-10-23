using System.Xml.Linq;
using DesignPatterns.Core.Compilation;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Formatting;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Formatting;
using Microsoft.CodeAnalysis.Host.Mef;
using Microsoft.CodeAnalysis.Recommendations;
using Microsoft.CodeAnalysis.Text;

namespace DesignPatterns.Ide;

/// <summary>
/// Editor language services over a reused <see cref="AdhocWorkspace"/>. Single-threaded safe: no Task.Run, no blocking waits;
/// the token is passed to every Roslyn async call. Offsets are always into the user source.
/// </summary>
public static class IdeService
{
    private sealed record State(AdhocWorkspace Workspace, DocumentId UserId);

    private static readonly Lazy<State> Shared = new(CreateState);

    private static readonly string[] Keywords =
    [
        "abstract", "as", "async", "await", "base", "bool", "break", "byte", "case", "catch", "char", "checked",
        "class", "const", "continue", "decimal", "default", "delegate", "do", "double", "else", "enum", "event",
        "explicit", "extern", "false", "finally", "fixed", "float", "for", "foreach", "if", "implicit", "in", "int",
        "interface", "internal", "is", "lock", "long", "namespace", "new", "null", "object", "operator", "out",
        "override", "params", "private", "protected", "public", "readonly", "record", "ref", "return", "sbyte",
        "sealed", "short", "static", "string", "struct", "switch", "this", "throw", "true", "try", "typeof",
        "uint", "ulong", "unchecked", "unsafe", "ushort", "using", "var", "virtual", "void", "volatile", "while", "yield",
    ];

    public static async Task<CompletionResult> CompleteAsync(string source, int offset, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        offset = Math.Clamp(offset, 0, source.Length);
        var (start, end) = IdentifierRange(source, offset);
        var document = GetDocument(source);

        var symbols = await Recommender.GetRecommendedSymbolsAtPositionAsync(document, start, cancellationToken: ct)
            .ConfigureAwait(false);

        var items = new List<CompletionItemInfo>();
        var seen = new HashSet<(string, string)>();
        foreach (var symbol in symbols)
        {
            if (symbol.IsImplicitlyDeclared || !IsIdentifierName(symbol.Name)) continue;
            var kind = KindOf(symbol);
            if (!seen.Add((symbol.Name, kind))) continue; // overloads collapse to one entry
            items.Add(new CompletionItemInfo(symbol.Name, kind,
                symbol.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat), symbol.Name));
        }

        if (!IsMemberAccess(source, start))
            foreach (var k in Keywords)
                if (seen.Add((k, "keyword")))
                    items.Add(new CompletionItemInfo(k, "keyword", null, k));

        return new CompletionResult(items, start, end);
    }

    public static async Task<HoverResult?> HoverAsync(string source, int offset, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var found = await FindSymbolAsync(source, offset, ct).ConfigureAwait(false);
        if (found is null) return null;
        var (symbol, token) = found.Value;

        var markdown = "```csharp\n" + Describe(symbol) + "\n```";
        var summary = Summary(symbol);
        if (summary is not null) markdown += "\n\n" + summary;
        return new HoverResult(markdown, token.SpanStart, token.Span.End);
    }

    public static async Task<DefinitionResult?> DefinitionAsync(string source, int offset, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var found = await FindSymbolAsync(source, offset, ct).ConfigureAwait(false);
        if (found is null) return null;
        var userTree = found.Value.Token.SyntaxTree;
        foreach (var location in found.Value.Symbol.Locations)
            if (location.IsInSource && location.SourceTree == userTree)
                return new DefinitionResult(location.SourceSpan.Start, location.SourceSpan.End);
        return null;
    }

    public static async Task<string> FormatAsync(string source, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var document = GetDocument(source);
        var root = await document.GetSyntaxRootAsync(ct).ConfigureAwait(false);
        if (root is not null) document = document.WithSyntaxRoot(BreakMemberBraces(root));
        var formatted = await Formatter.FormatAsync(document, cancellationToken: ct).ConfigureAwait(false);
        var text = (await formatted.GetTextAsync(ct).ConfigureAwait(false)).ToString();

        // The formatter emits the platform newline; keep the learner's own style.
        var lf = text.Replace("\r\n", "\n");
        return source.Contains("\r\n") ? lf.Replace("\n", "\r\n") : lf;
    }

    /// <summary>
    /// The formatter keeps one-line bodies as they are. Put the braces of types, namespaces, members and accessors
    /// on their own lines (elastic, so it only applies where the learner has not already broken the line).
    /// Statement blocks (if/for/lambda) are left alone.
    /// </summary>
    private static SyntaxNode BreakMemberBraces(SyntaxNode root)
    {
        var edits = new Dictionary<SyntaxToken, SyntaxToken>();
        foreach (var token in root.DescendantTokens())
        {
            var isOpen = token.IsKind(SyntaxKind.OpenBraceToken);
            if (!isOpen && !token.IsKind(SyntaxKind.CloseBraceToken)) continue;
            if (!IsMemberBrace(token.Parent)) continue;

            var prev = token.GetPreviousToken();
            var next = token.GetNextToken();
            var addBefore = prev.RawKind != 0 && !HasEol(prev.TrailingTrivia) && !HasEol(token.LeadingTrivia)
                && !(!isOpen && prev.IsKind(SyntaxKind.OpenBraceToken));
            var addAfter = next.RawKind != 0 && !HasEol(token.TrailingTrivia) && !HasEol(next.LeadingTrivia)
                && !next.IsKind(SyntaxKind.SemicolonToken) && !next.IsKind(SyntaxKind.CommaToken)
                && !next.IsKind(SyntaxKind.CloseParenToken)
                && !(isOpen && next.IsKind(SyntaxKind.CloseBraceToken));
            if (!addBefore && !addAfter) continue;

            var edited = token;
            if (addBefore) edited = edited.WithLeadingTrivia(edited.LeadingTrivia.Add(SyntaxFactory.ElasticCarriageReturnLineFeed));
            if (addAfter) edited = edited.WithTrailingTrivia(edited.TrailingTrivia.Add(SyntaxFactory.ElasticCarriageReturnLineFeed));
            edits[token] = edited;
        }
        return edits.Count == 0 ? root : root.ReplaceTokens(edits.Keys, (original, _) => edits[original]);
    }

    private static bool IsMemberBrace(SyntaxNode? parent) => parent switch
    {
        BaseTypeDeclarationSyntax or BaseNamespaceDeclarationSyntax or AccessorListSyntax => true,
        BlockSyntax b => b.Parent is BaseMethodDeclarationSyntax or AccessorDeclarationSyntax or LocalFunctionStatementSyntax,
        _ => false,
    };

    private static bool HasEol(SyntaxTriviaList trivia) => trivia.Any(t => t.IsKind(SyntaxKind.EndOfLineTrivia));

    /// <summary>The compilation the IDE sees: exactly the global-usings tree plus the user tree.</summary>
    internal static async Task<Compilation> GetCompilationAsync(string source, CancellationToken ct) =>
        (await GetDocument(source).Project.GetCompilationAsync(ct).ConfigureAwait(false))!;

    private static State CreateState()
    {
        var host = MefHostServices.Create(
        [
            typeof(Workspace).Assembly,
            typeof(CSharpFormattingOptions).Assembly,
        ]);
        var workspace = new AdhocWorkspace(host);

        var options = new CSharpCompilationOptions(OutputKind.ConsoleApplication)
            .WithNullableContextOptions(NullableContextOptions.Enable)
            .WithConcurrentBuild(false);
        var project = workspace.AddProject(ProjectInfo.Create(
            ProjectId.CreateNewId(), VersionStamp.Create(), "UserCode", "UserCode", LanguageNames.CSharp,
            compilationOptions: options,
            parseOptions: CompilerDefaults.ParseOptions,
            metadataReferences: CompilerDefaults.References));

        var usings = string.Concat(CompilerDefaults.ImplicitUsings.Select(ns => $"global using global::{ns};\n"));
        project = project.AddDocument(CompilerDefaults.GlobalUsingsPath, SourceText.From(usings),
            filePath: CompilerDefaults.GlobalUsingsPath).Project;
        var user = project.AddDocument(CompilerDefaults.UserPath, SourceText.From(""), filePath: CompilerDefaults.UserPath);
        if (!workspace.TryApplyChanges(user.Project.Solution))
            throw new InvalidOperationException("Could not set up the IDE workspace.");
        return new State(workspace, user.Id);
    }

    /// <summary>The user document with <paramref name="source"/>. Changes are never applied back to the workspace.</summary>
    private static Document GetDocument(string source)
    {
        var state = Shared.Value;
        return state.Workspace.CurrentSolution.GetDocument(state.UserId)!.WithText(SourceText.From(source));
    }

    private static async Task<(ISymbol Symbol, SyntaxToken Token)?> FindSymbolAsync(string source, int offset, CancellationToken ct)
    {
        offset = Math.Clamp(offset, 0, source.Length);
        var document = GetDocument(source);
        var root = await document.GetSyntaxRootAsync(ct).ConfigureAwait(false);
        var model = await document.GetSemanticModelAsync(ct).ConfigureAwait(false);
        if (root is null || model is null) return null;

        var token = root.FindToken(offset);
        if (!token.IsKind(SyntaxKind.IdentifierToken) && offset > 0)
            token = root.FindToken(offset - 1);
        if (!token.IsKind(SyntaxKind.IdentifierToken) || offset > token.Span.End || offset < token.SpanStart) return null;

        for (var node = token.Parent; node is not null; node = node.Parent)
        {
            var info = model.GetSymbolInfo(node, ct);
            var symbol = info.Symbol ?? info.CandidateSymbols.FirstOrDefault() ?? model.GetDeclaredSymbol(node, ct);
            if (symbol is not null) return (symbol, token);
            if (node.Span.Length > token.Span.Length) break; // only the token's own node
        }
        return null;
    }

    private static string Describe(ISymbol symbol)
    {
        var display = symbol.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat);
        if (symbol is INamedTypeSymbol type)
        {
            var keyword = type.TypeKind switch
            {
                TypeKind.Interface => "interface",
                TypeKind.Struct => "struct",
                TypeKind.Enum => "enum",
                TypeKind.Delegate => "delegate",
                _ => type.IsRecord ? "record" : "class",
            };
            return $"{keyword} {display}";
        }
        return symbol switch
        {
            ILocalSymbol => $"(local variable) {display}",
            IParameterSymbol => $"(parameter) {display}",
            _ => display,
        };
    }

    private static string? Summary(ISymbol symbol)
    {
        try
        {
            var xml = symbol.GetDocumentationCommentXml();
            if (string.IsNullOrWhiteSpace(xml)) return null;
            var summary = XElement.Parse("<r>" + xml + "</r>").Descendants("summary").FirstOrDefault();
            if (summary is null) return null;
            var text = string.Join(" ", summary.Value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            return text.Length == 0 ? null : text;
        }
        catch (System.Xml.XmlException)
        {
            return null;
        }
    }

    private static string KindOf(ISymbol symbol) => symbol switch
    {
        INamedTypeSymbol t => t.TypeKind switch
        {
            TypeKind.Interface => "interface",
            TypeKind.Struct => "struct",
            TypeKind.Enum => "enum",
            _ => "class",
        },
        ITypeParameterSymbol => "class",
        IMethodSymbol => "method",
        IPropertySymbol => "property",
        IFieldSymbol => "field",
        IEventSymbol => "event",
        ILocalSymbol or IRangeVariableSymbol => "local",
        IParameterSymbol => "parameter",
        INamespaceSymbol => "namespace",
        _ => "local",
    };

    private static bool IsIdentifierName(string name) =>
        name.Length > 0 && (char.IsLetter(name[0]) || name[0] == '_');

    private static bool IsIdentChar(char c) => char.IsLetterOrDigit(c) || c == '_';

    private static (int Start, int End) IdentifierRange(string source, int offset)
    {
        var start = offset;
        while (start > 0 && IsIdentChar(source[start - 1])) start--;
        var end = offset;
        while (end < source.Length && IsIdentChar(source[end])) end++;
        return (start, end);
    }

    private static bool IsMemberAccess(string source, int identifierStart)
    {
        var i = identifierStart - 1;
        while (i >= 0 && char.IsWhiteSpace(source[i])) i--;
        return i >= 0 && source[i] == '.';
    }
}
