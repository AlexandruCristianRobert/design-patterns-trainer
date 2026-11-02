using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class CloudUploadChecks
{
    const BindingFlags Instance = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;

    // The method `maker` declares that returns a `made`: it takes no parameters, the code that uses `maker` can call it, and each subtype can fill it in.
    static MethodInfo MakingMethod(Type maker, Type made)
    {
        var found = maker.GetMethods(Instance | BindingFlags.DeclaredOnly).Where(m => m.ReturnType == made && !m.IsSpecialName).ToList();
        if (found.Count == 0) Expect.Fail("noMakingMethod", new { maker = maker.Name, made = made.Name });
        var method = found.FirstOrDefault(m => m.GetParameters().Length == 0);
        if (method is null) Expect.Fail("makingMethodParameters", new { maker = maker.Name, method = found[0].Name });
        Expect.That(method.IsAbstract || method.IsVirtual && !method.IsFinal, "makingMethodFixed", new { maker = maker.Name, method = method.Name });
        Expect.That(method.IsPublic || method.IsAssembly || method.IsFamilyOrAssembly, "makingMethodHidden", new { maker = maker.Name, method = method.Name });
        return method;
    }

    // The source of `user` names none of the program's classes that implement or derive from any of `kinds`.
    static void NamesNoConcreteClass(string user, params Type[] kinds)
    {
        var classes = kinds[0].Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(CloudUploadChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == user))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "userNamesConcreteClass", new { user, type = named });
        }
    }

    // `made` is a new object of class `expected`, not the same one as `again`.
    static void IsNew(string type, string method, object? made, object? again, Type expected)
    {
        Expect.That(made?.GetType() == expected, "opensWrongClass", new { type, method, expected = expected.Name, actual = made?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(made, again), "reusesObject", new { type, method });
    }

    [Check("stores-and-queues-use-their-cloud")]
    static void StoresAndQueuesUseTheirCloud()
    {
        var nimbus = $"{new NimbusStore().Save("cat.jpg")} / {new NimbusQueue().Send("hi")}";
        var stratus = $"{new StratusStore().Save("cat.jpg")} / {new StratusQueue().Send("hi")}";

        Expect.That(nimbus == "nimbus://photos/cat.jpg / nimbus-queue <- hi", "wrongNimbus", new { actual = nimbus });
        Expect.That(stratus == "stratus:/blobs/cat.jpg / stratus-mq: hi", "wrongStratus", new { actual = stratus });
    }

    [Check("each-account-opens-its-own-cloud")]
    static void EachAccountOpensItsOwnCloud()
    {
        CloudAccount nimbus = new NimbusAccount();
        CloudAccount stratus = new StratusAccount();
        IsNew("NimbusAccount", "OpenStore", nimbus.OpenStore(), nimbus.OpenStore(), typeof(NimbusStore));
        IsNew("NimbusAccount", "OpenQueue", nimbus.OpenQueue(), nimbus.OpenQueue(), typeof(NimbusQueue));
        IsNew("StratusAccount", "OpenStore", stratus.OpenStore(), stratus.OpenStore(), typeof(StratusStore));
        IsNew("StratusAccount", "OpenQueue", stratus.OpenQueue(), stratus.OpenQueue(), typeof(StratusQueue));
    }

    [Check("upload-stays-in-one-cloud")]
    static void UploadStaysInOneCloud()
    {
        var nimbus = string.Join(" / ", new PhotoUploader(new NimbusAccount()).Upload(["cat.jpg", "dog.jpg"]));
        var stratus = string.Join(" / ", new PhotoUploader(new StratusAccount()).Upload(["owl.png"]));

        Expect.That(nimbus == "nimbus-queue <- resize nimbus://photos/cat.jpg / nimbus-queue <- resize nimbus://photos/dog.jpg / 2 photos uploaded", "wrongNimbusUpload", new { actual = nimbus });
        Expect.That(stratus == "stratus-mq: resize stratus:/blobs/owl.png / 1 photos uploaded", "wrongStratusUpload", new { actual = stratus });
    }

    [Check("empty-upload-still-counts")]
    static void EmptyUploadStillCounts()
    {
        var lines = string.Join(" / ", new PhotoUploader(new StratusAccount()).Upload([]));

        Expect.That(lines == "0 photos uploaded", "wrongEmptyUpload", new { actual = lines });
    }

    [Check("uploader-knows-only-the-account")]
    static void UploaderKnowsOnlyTheAccount()
    {
        var maker = typeof(CloudAccount);
        Expect.That(maker.IsInterface || maker.IsAbstract, "makerNotAbstract", new { maker = maker.Name });
        MakingMethod(maker, typeof(IBlobStore));
        MakingMethod(maker, typeof(IMessageQueue));
        NamesNoConcreteClass("PhotoUploader", typeof(IBlobStore), typeof(IMessageQueue), maker);
    }
}
