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
