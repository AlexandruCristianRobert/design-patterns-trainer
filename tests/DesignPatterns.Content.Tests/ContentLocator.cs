using DesignPatterns.Core.Contracts;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace DesignPatterns.Content.Tests;

public static class ContentLocator
{
    public static string Root { get; } = FindRoot();

    private static string FindRoot()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            if (File.Exists(Path.Combine(dir.FullName, "DesignPatterns.slnx")))
                return Path.Combine(dir.FullName, "content");
        throw new DirectoryNotFoundException("DesignPatterns.slnx not found above " + AppContext.BaseDirectory);
    }

    internal static readonly IDeserializer Yaml = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    internal sealed class ExerciseYaml
    {
        public string Kind { get; set; } = "";
        public int Version { get; set; }
        public ContractYaml Contract { get; set; } = new();
    }
    internal sealed class ContractYaml { public List<ContractTypeYaml> Types { get; set; } = []; }
    internal sealed class ContractTypeYaml
    {
        public string Name { get; set; } = "";
        public string Kind { get; set; } = "any";
        public List<string> Members { get; set; } = [];
    }

    public static IEnumerable<ExerciseFiles> Exercises(string contentRoot)
    {
        var patterns = Path.Combine(contentRoot, "patterns");
        if (!Directory.Exists(patterns)) yield break;
        foreach (var patternDir in Directory.GetDirectories(patterns).Order())
        {
            var exercises = Path.Combine(patternDir, "exercises");
            if (!Directory.Exists(exercises)) continue;
            foreach (var dir in Directory.GetDirectories(exercises).Order())
                yield return Load(Path.GetFileName(patternDir), dir);
        }
    }

    internal sealed class ExamQuestionYaml
    {
        public int Version { get; set; }
        public ContractYaml Contract { get; set; } = new();
    }
    internal sealed class PatternYaml
    {
        public List<string> ExamQuestions { get; set; } = [];
        public List<string> RoleNames { get; set; } = [];
    }

    public sealed record ExamListing(string PatternId, IReadOnlyList<string> Listed, IReadOnlyList<string> OnDisk);

    private static PatternYaml ReadPattern(string patternDir)
    {
        var path = Path.Combine(patternDir, "pattern.yaml");
        return File.Exists(path) ? Yaml.Deserialize<PatternYaml>(File.ReadAllText(path)) ?? new PatternYaml() : new PatternYaml();
    }

    /// <summary>kebab-case id to PascalCase name (observer gives Observer).</summary>
    internal static string PascalName(string id) =>
        string.Concat(id.Split('-', StringSplitOptions.RemoveEmptyEntries).Select(p => char.ToUpperInvariant(p[0]) + p[1..]));

    /// <summary>Each Pattern's pattern.yaml examQuestions list next to its exam/* directories.</summary>
    public static IEnumerable<ExamListing> ExamListings(string contentRoot)
    {
        var patterns = Path.Combine(contentRoot, "patterns");
        if (!Directory.Exists(patterns)) yield break;
        foreach (var patternDir in Directory.GetDirectories(patterns).Order())
        {
            IReadOnlyList<string> listed;
            try { listed = ReadPattern(patternDir).ExamQuestions; }
            catch (Exception) { listed = []; }
            var exam = Path.Combine(patternDir, "exam");
            var onDisk = Directory.Exists(exam)
                ? Directory.GetDirectories(exam).Select(d => Path.GetFileName(d)).Order().ToList() : [];
            yield return new ExamListing(Path.GetFileName(patternDir), listed, onDisk);
        }
    }

    public static IEnumerable<ExamQuestionFiles> ExamQuestions(string contentRoot)
    {
        var patterns = Path.Combine(contentRoot, "patterns");
        if (!Directory.Exists(patterns)) yield break;
        foreach (var patternDir in Directory.GetDirectories(patterns).Order())
        {
            var exam = Path.Combine(patternDir, "exam");
            if (!Directory.Exists(exam)) continue;
            foreach (var dir in Directory.GetDirectories(exam).Order())
                yield return LoadExam(Path.GetFileName(patternDir), patternDir, dir);
        }
    }

    private static ExamQuestionFiles LoadExam(string patternId, string patternDir, string dir)
    {
        try
        {
            var p = ReadPattern(patternDir);
            var y = Yaml.Deserialize<ExamQuestionYaml>(File.ReadAllText(Path.Combine(dir, "question.yaml"))) ?? new ExamQuestionYaml();
            var contract = new Contract(y.Contract.Types
                .Select(t => new ContractType(t.Name, ParseKind(t.Kind), t.Members)).ToList());
            var texts = Directory.GetFiles(dir, "text.*.yaml").Order().ToDictionary(
                f => Path.GetFileName(f).Split('.')[1], f => f);
            return new ExamQuestionFiles(patternId, Path.GetFileName(dir), y.Version, contract,
                File.ReadAllText(Path.Combine(dir, "solution.cs")), File.ReadAllText(Path.Combine(dir, "checks.cs")),
                texts, p.RoleNames, PascalName(patternId));
        }
        catch (Exception e)
        {
            return new ExamQuestionFiles(patternId, Path.GetFileName(dir), 0, new Contract([]), "", "",
                new Dictionary<string, string>(), [], PascalName(patternId), [$"cannot load exam question: {e.Message}"]);
        }
    }

    /// <summary>Every locale that has a text.&lt;lng&gt;.yaml anywhere under the content root (always includes "en").</summary>
    public static IReadOnlySet<string> Locales(string contentRoot)
    {
        var set = new HashSet<string> { "en" };
        var patterns = Path.Combine(contentRoot, "patterns");
        if (Directory.Exists(patterns))
            foreach (var f in Directory.EnumerateFiles(patterns, "text.*.yaml", SearchOption.AllDirectories))
                set.Add(Path.GetFileName(f).Split('.')[1]);
        return set;
    }

    private static ExerciseFiles Load(string patternId, string dir)
    {
        try { return LoadCore(patternId, dir); }
        catch (Exception e)
        {
            return new ExerciseFiles(patternId, Path.GetFileName(dir), "", 0, new Contract([]), "", "", "",
                new Dictionary<string, string>(), [$"cannot load exercise: {e.Message}"]);
        }
    }

    private static ExerciseFiles LoadCore(string patternId, string dir)
    {
        var y =Yaml.Deserialize<ExerciseYaml>(File.ReadAllText(Path.Combine(dir, "exercise.yaml"))) ?? new ExerciseYaml();
        var contract = new Contract(y.Contract.Types
            .Select(t => new ContractType(t.Name, ParseKind(t.Kind), t.Members)).ToList());
        var texts = Directory.GetFiles(dir, "text.*.yaml").Order().ToDictionary(
            p => Path.GetFileName(p).Split('.')[1], p => p);
        return new ExerciseFiles(patternId, Path.GetFileName(dir), y.Kind, y.Version, contract,
            File.ReadAllText(Path.Combine(dir, "starter.cs")),
            File.ReadAllText(Path.Combine(dir, "solution.cs")),
            File.ReadAllText(Path.Combine(dir, "checks.cs")), texts);
    }

    private static ContractTypeKind ParseKind(string kind) => kind switch
    {
        "class" => ContractTypeKind.Class,
        "abstractClass" => ContractTypeKind.AbstractClass,
        "interface" => ContractTypeKind.Interface,
        "any" => ContractTypeKind.Any,
        _ => throw new InvalidDataException($"Unknown contract type kind '{kind}'")
    };
}
