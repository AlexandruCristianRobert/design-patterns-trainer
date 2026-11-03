using System.Reflection;
using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class SlideshowChecks
{
    const BindingFlags Declared = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    // True when `type` or one of its base classes keeps an instance field of type `held`.
    static bool Keeps(Type type, Type held)
    {
        for (var t = type; t is not null && t != typeof(object); t = t.BaseType)
            if (t.GetFields(Declared).Any(f => f.FieldType == held)) return true;
        return false;
    }

    // No class that is `top` or derives from it names one of the program's classes that implement or derive from `held`.
    static void NamesNoScreenClass(Type top, Type held)
    {
        var classes = held.Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && held.IsAssignableFrom(t))
            .Select(t => t.Name).ToHashSet();
        var users = top.Assembly.GetTypes().Where(top.IsAssignableFrom).Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => users.Contains(c.Identifier.ValueText)))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "namesScreen", new { user = declaration.Identifier.ValueText, type = named });
        }
    }

    [Check("screens-show-photos-their-own-way")]
    static void ScreensShowPhotosTheirOwnWay()
    {
        var lcd = $"{new LcdFrame().Picture("cat.jpg")} / {new LcdFrame().Caption("hello")}";
        var tv = $"{new TvStick().Picture("cat.jpg")} / {new TvStick().Caption("hello")}";

        Expect.That(lcd == "lcd: cat.jpg / lcd caption: hello", "wrongLcd", new { expected = "lcd: cat.jpg / lcd caption: hello", actual = lcd });
        Expect.That(tv == "tv full screen: cat.jpg / tv banner: hello", "wrongTv", new { expected = "tv full screen: cat.jpg / tv banner: hello", actual = tv });
    }

    [Check("in-order-on-both-screens")]
    static void InOrderOnBothScreens()
    {
        var lcd = string.Join(" | ", new InOrder(new LcdFrame()).Run(["a.jpg", "b.jpg"]));
        var tv = string.Join(" | ", new InOrder(new TvStick()).Run(["a.jpg", "b.jpg"]));
        var empty = string.Join(" | ", new InOrder(new LcdFrame()).Run([]));

        Expect.That(lcd == "lcd: a.jpg | lcd: b.jpg | lcd caption: 2 photos", "wrongInOrder", new { screen = "LCD frame", photos = "a.jpg and b.jpg", actual = lcd, expected = "lcd: a.jpg | lcd: b.jpg | lcd caption: 2 photos" });
        Expect.That(tv == "tv full screen: a.jpg | tv full screen: b.jpg | tv banner: 2 photos", "wrongInOrder", new { screen = "TV stick", photos = "a.jpg and b.jpg", actual = tv, expected = "tv full screen: a.jpg | tv full screen: b.jpg | tv banner: 2 photos" });
        Expect.That(empty == "lcd caption: 0 photos", "wrongInOrder", new { screen = "LCD frame", photos = "no photos", actual = empty, expected = "lcd caption: 0 photos" });
    }

    [Check("newest-first-on-both-screens")]
    static void NewestFirstOnBothScreens()
    {
        List<string> photos = ["a.jpg", "b.jpg", "c.jpg"];
        var tv = string.Join(" | ", new NewestFirst(new TvStick()).Run(photos));
        var lcd = string.Join(" | ", new NewestFirst(new LcdFrame()).Run(photos));

        Expect.That(tv == "tv banner: newest first | tv full screen: c.jpg | tv full screen: b.jpg | tv full screen: a.jpg", "wrongNewestFirst", new { screen = "TV stick", actual = tv, expected = "tv banner: newest first | tv full screen: c.jpg | tv full screen: b.jpg | tv full screen: a.jpg" });
        Expect.That(lcd == "lcd caption: newest first | lcd: c.jpg | lcd: b.jpg | lcd: a.jpg", "wrongNewestFirst", new { screen = "LCD frame", actual = lcd, expected = "lcd caption: newest first | lcd: c.jpg | lcd: b.jpg | lcd: a.jpg" });
        Expect.That(string.Join(", ", photos) == "a.jpg, b.jpg, c.jpg", "changedList", new { actual = string.Join(", ", photos) });
    }

    [Check("slideshows-hold-a-screen")]
    static void SlideshowsHoldAScreen()
    {
        var screen = typeof(Screen);
        Expect.That(screen.IsInterface || screen.IsAbstract, "screenNotAbstract");
        foreach (var show in new[] { typeof(InOrder), typeof(NewestFirst) })
        {
            Expect.That(typeof(Slideshow).IsAssignableFrom(show), "notASlideshow", new { type = show.Name });
            Expect.That(Keeps(show, screen), "holdsNoScreen", new { type = show.Name });
        }
        NamesNoScreenClass(typeof(Slideshow), screen);
    }
}
