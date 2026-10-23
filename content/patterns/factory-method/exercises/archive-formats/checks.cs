using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class ArchiveFormatChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // The method `owner` declares that returns a `made`: abstract or virtual, public or protected, taking `parameters`.
    static MethodInfo MakingMethod(Type owner, Type made, params Type[] parameters)
    {
        var found = owner.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { owner = owner.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Select(p => p.ParameterType).SequenceEqual(parameters));
        if (method is null) Expect.Fail("makingMethodParameters", new { owner = owner.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { owner = owner.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsFamily || method.IsFamilyOrAssembly, "makingMethodPrivate", new { owner = owner.Name, method = method.Name });
        return method;
    }

    // Each subclass derives from `owner`, and neither it nor a class between them declares its own `operation`.
    static void OperationWrittenOnce(Type owner, string operation, params Type[] subclasses)
    {
        foreach (var sub in subclasses)
        {
            Expect.That(sub != owner && owner.IsAssignableFrom(sub), "notASubclass", new { type = sub.Name, owner = owner.Name });
            for (var t = sub; t != owner; t = t.BaseType!)
                Expect.That(!t.GetMethods(Instance | BindingFlags.DeclaredOnly).Any(m => m.Name == operation),
                    "operationRedeclared", new { type = t.Name, method = operation });
        }
    }

    // The source of `owner` names none of the program's classes that implement `made`.
    static void NamesNoMadeClass(string owner, Type made)
    {
        var classes = made.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && made.IsAssignableFrom(t) && t.DeclaringType != typeof(ArchiveFormatChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == owner))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "ownerNamesMadeClass", new { owner, type = named });
        }
    }

    // Asks a new `type` twice through `making` and expects two new objects of class `expected`.
    static void MakesItsOwn(MethodInfo making, Type type, Type expected)
    {
        var instance = Activator.CreateInstance(type);
        var first = making.Invoke(instance, null);
        var second = making.Invoke(instance, null);
        Expect.That(first?.GetType() == expected, "makesWrongClass", new { type = type.Name, expected = expected.Name, actual = first?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(first, second), "reusesObject", new { type = type.Name, method = making.Name });
    }

    static string Shrinks(ICompressor compressor) => $"{compressor.Extension} {compressor.Compress(301)} {compressor.Compress(7)}";

    [Check("compressors-shrink-by-their-rule")]
    static void CompressorsShrinkByTheirRule()
    {
        var zip = Shrinks(new ZipCompressor());
        var gzip = Shrinks(new GzipCompressor());
        var none = Shrinks(new NoCompressor());

        Expect.That(zip == "zip 150 3", "wrongZip", new { actual = zip });
        Expect.That(gzip == "tar.gz 120 2", "wrongGzip", new { actual = gzip });
        Expect.That(none == "tar 301 7", "wrongNone", new { actual = none });
    }

    [Check("pack-names-and-sizes-the-archive")]
    static void PackNamesAndSizesTheArchive()
    {
        var zip = new ZipArchiver().Pack("photos", [100, 301]);
        var gzip = new GzipArchiver().Pack("photos", [100, 301]);
        var tar = new TarArchiver().Pack("photos", [100, 301]);

        Expect.That(zip == "photos.zip: 401 -> 200 bytes", "wrongZipPack", new { actual = zip });
        Expect.That(gzip == "photos.tar.gz: 401 -> 160 bytes", "wrongGzipPack", new { actual = gzip });
        Expect.That(tar == "photos.tar: 401 -> 401 bytes", "wrongTarPack", new { actual = tar });
    }

    [Check("pack-compresses-each-file-on-its-own")]
    static void PackCompressesEachFileOnItsOwn()
    {
        var zip = new ZipArchiver().Pack("backup", [101, 101]);

        Expect.That(zip == "backup.zip: 202 -> 100 bytes", "wrongPerFile", new { actual = zip });
    }

    [Check("estimate-uses-the-same-format")]
    static void EstimateUsesTheSameFormat()
    {
        var zip = new ZipArchiver().Estimate(1000);
        var gzip = new GzipArchiver().Estimate(1000);
        var tar = new TarArchiver().Estimate(1000);

        Expect.That(zip == 500 && gzip == 400 && tar == 1000, "wrongEstimate", new { zip, gzip, tar });
    }

    [Check("archiver-knows-only-icompressor")]
    static void ArchiverKnowsOnlyICompressor()
    {
        var making = MakingMethod(typeof(Archiver), typeof(ICompressor));
        OperationWrittenOnce(typeof(Archiver), "Pack", typeof(ZipArchiver), typeof(GzipArchiver), typeof(TarArchiver));
        OperationWrittenOnce(typeof(Archiver), "Estimate", typeof(ZipArchiver), typeof(GzipArchiver), typeof(TarArchiver));
        NamesNoMadeClass("Archiver", typeof(ICompressor));
        MakesItsOwn(making, typeof(ZipArchiver), typeof(ZipCompressor));
        MakesItsOwn(making, typeof(GzipArchiver), typeof(GzipCompressor));
        MakesItsOwn(making, typeof(TarArchiver), typeof(NoCompressor));
    }
}
