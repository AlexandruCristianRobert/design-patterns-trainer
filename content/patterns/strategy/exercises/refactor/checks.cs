using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ContactExportChecks
{
    static IEnumerable<TypeDeclarationSyntax> Exporters() =>
        Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>()
            .Where(c => c.Identifier.ValueText == "ContactExporter");

    static List<string> Names(TypeDeclarationSyntax declaration) =>
        declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).ToList();

    // Classes written in the program that implement one of its interfaces or extend one of its abstract classes.
    static HashSet<string> FormatClasses()
    {
        var assembly = typeof(Contact).Assembly;
        bool Own(Type t) => t.Assembly == assembly && t.DeclaringType != typeof(ContactExportChecks);
        bool ExtendsOwnAbstract(Type t)
        {
            for (var b = t.BaseType; b is not null; b = b.BaseType)
                if (b.IsAbstract && Own(b)) return true;
            return false;
        }
        return assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && Own(t) && t.Name != "ContactExporter" &&
                (t.GetInterfaces().Any(Own) || ExtendsOwnAbstract(t)))
            .Select(t => t.Name).ToHashSet();
    }

    [Check("output-unchanged")]
    static void OutputUnchanged()
    {
        string[] expected =
        [
            "export of 2 contacts",
            "name,email",
            "Ana Pop,ana@example.com",
            "Radu Ionescu,radu@example.com",
            "export of 2 contacts",
            "Ana Pop <ana@example.com>",
            "Radu Ionescu <radu@example.com>",
            "export of 2 contacts",
            "{\"name\":\"Ana Pop\",\"email\":\"ana@example.com\"}",
            "{\"name\":\"Radu Ionescu\",\"email\":\"radu@example.com\"}",
        ];
        var actual = Demo.Run();
        for (var i = 0; i < Math.Max(expected.Length, actual.Count); i++)
        {
            var want = i < expected.Length ? expected[i] : "(no line)";
            var got = i < actual.Count ? actual[i] : "(no line)";
            Expect.That(want == got, "outputChanged", new { line = i + 1, expected = want, actual = got });
        }
    }

    [Check("exporter-does-not-branch-on-format")]
    static void ExporterDoesNotBranchOnFormat()
    {
        foreach (var exporter in Exporters())
        {
            var hasSwitch = exporter.DescendantNodes().Any(n => n is SwitchStatementSyntax or SwitchExpressionSyntax);
            var names = Names(exporter);
            Expect.That(!hasSwitch, "exporterSwitches");
            Expect.That(!names.Contains("ExportFormat"), "exporterNamesEnum");
            Expect.That(!names.Contains("GetType"), "exporterChecksType");
        }
    }

    [Check("exporter-knows-no-format-class")]
    static void ExporterKnowsNoFormatClass()
    {
        var formats = FormatClasses();
        foreach (var exporter in Exporters())
        {
            var named = Names(exporter).FirstOrDefault(formats.Contains);
            Expect.That(named is null, "exporterNamesFormat", new { type = named });
        }
    }
}
