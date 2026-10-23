using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class BuildStatusChecks
{
    sealed class Recorder : IBuildWatcher
    {
        public List<(string Project, bool Passed)> Heard { get; } = [];
        public void OnBuildFinished(string project, bool passed) => Heard.Add((project, passed));
    }

    // The type itself plus every element and generic argument type, e.g. List<ChatBot> yields List<ChatBot> and ChatBot.
    static IEnumerable<Type> Mentioned(Type t)
    {
        yield return t;
        if (t.GetElementType() is { } element)
            foreach (var x in Mentioned(element)) yield return x;
        if (t.IsGenericType)
            foreach (var arg in t.GetGenericArguments())
                foreach (var x in Mentioned(arg)) yield return x;
    }

    [Check("every-watcher-told")]
    static void EveryWatcherTold()
    {
        var server = new BuildServer();
        var watchers = new[] { new Recorder(), new Recorder(), new Recorder() };
        foreach (var w in watchers) server.AddWatcher(w);

        server.FinishBuild("web", true);
        server.FinishBuild("api", false);

        for (var i = 0; i < watchers.Length; i++)
        {
            var heard = watchers[i].Heard;
            Expect.That(heard.Count == 2, "wrongCount", new { watcher = i + 1, count = heard.Count });
            Expect.That(heard[0] == ("web", true) && heard[1] == ("api", false), "wrongResult", new { watcher = i + 1 });
        }
    }

    [Check("removed-watcher-not-told")]
    static void RemovedWatcherNotTold()
    {
        var server = new BuildServer();
        var leaving = new Recorder();
        var staying = new Recorder();
        server.AddWatcher(leaving);
        server.AddWatcher(staying);

        server.RemoveWatcher(leaving);
        server.FinishBuild("web", true);

        Expect.That(leaving.Heard.Count == 0, "toldAfterRemove");
        Expect.That(staying.Heard.Count == 1, "stayingMissed");
    }

    [Check("no-watchers-ok")]
    static void NoWatchersOk()
    {
        var server = new BuildServer();
        server.FinishBuild("web", true);

        var stranger = new Recorder();
        server.RemoveWatcher(stranger);
        server.FinishBuild("api", false);

        Expect.That(stranger.Heard.Count == 0, "strangerTold");
    }

    [Check("server-knows-only-the-interface")]
    static void ServerKnowsOnlyTheInterface()
    {
        var concrete = typeof(IBuildWatcher).Assembly.GetTypes()
            .Where(t => !t.IsInterface && typeof(IBuildWatcher).IsAssignableFrom(t) && t.DeclaringType != typeof(BuildStatusChecks))
            .Select(t => t.Name).ToHashSet();

        var fields = Code.Type("BuildServer").Clr.GetFields(BindingFlags.Instance | BindingFlags.Static |
            BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly);
        foreach (var field in fields)
        {
            var named = Mentioned(field.FieldType).FirstOrDefault(t => concrete.Contains(t.Name));
            Expect.That(named is null, "concreteField", new { type = named?.Name });
        }

        foreach (var declaration in Source.Root.DescendantNodes().OfType<ClassDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "BuildServer"))
        {
            var named = declaration.DescendantNodes().OfType<IdentifierNameSyntax>()
                .Select(n => n.Identifier.ValueText).FirstOrDefault(concrete.Contains);
            Expect.That(named is null, "serverNamesWatcher", new { type = named });
        }
    }
}
