using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class PuzzleLevelChecks
{
    // All Checks share one load of the program, so Level.Loaded may already be above 0 when a Check starts.
    // Each Check therefore counts only the levels loaded while it runs.

    [Check("nothing-loads-at-start")]
    static void NothingLoadsAtStart()
    {
        var before = Level.Loaded;
        new LevelSlot(1, true);
        new LevelSlot(5, true);
        var slots = Level.Loaded - before;
        Expect.That(slots == 0, "slotLoadedEarly", new { loaded = slots });

        new GameMenu(true);
        new GameMenu(false);
        var menus = Level.Loaded - before;
        Expect.That(menus == 0, "menuLoadedEarly", new { loaded = menus });
    }

    [Check("level-loads-on-first-play-once")]
    static void LevelLoadsOnFirstPlayOnce()
    {
        var before = Level.Loaded;
        var slot = new LevelSlot(2, false);
        var first = slot.Play();
        var afterFirst = Level.Loaded - before;
        Expect.That(afterFirst == 1, "notLoadedOnFirstPlay", new { loaded = afterFirst });

        slot.Play();
        slot.Play();
        var loaded = Level.Loaded - before;
        Expect.That(loaded == 1, "loadedMoreThanOnce", new { loaded });

        var real = new Level(2).Play();
        Expect.That(first == real, "differentResult", new { shown = first, real });
    }

    [Check("full-game-levels-stay-locked")]
    static void FullGameLevelsStayLocked()
    {
        var before = Level.Loaded;
        var four = new LevelSlot(4, false).Play();
        var six = new LevelSlot(6, false).Play();
        var loaded = Level.Loaded - before;
        Expect.That(four == "Level 4 is in the full game" && six == "Level 6 is in the full game", "wrongLock", new { four, six });
        Expect.That(loaded == 0, "loadedLockedLevel", new { loaded });

        var free = new LevelSlot(3, false).Play();
        var full = new LevelSlot(4, true).Play();
        var expectedFree = new Level(3).Play();
        var expectedFull = new Level(4).Play();
        Expect.That(free == expectedFree && full == expectedFull, "wrongOpenLevels",
            new { free, full, expectedFree, expectedFull });
    }

    [Check("menu-plays-through-its-slots")]
    static void MenuPlaysThroughItsSlots()
    {
        var before = Level.Loaded;
        var menu = new GameMenu(false);
        var two = menu.Start(2);
        var again = menu.Start(2);
        var five = menu.Start(5);
        var loaded = Level.Loaded - before;

        var expectedTwo = new Level(2).Play();
        Expect.That(two == expectedTwo && again == expectedTwo, "wrongMenuLevel", new { two, again, expected = expectedTwo });
        Expect.That(five == "Level 5 is in the full game", "wrongMenuLock", new { five });
        Expect.That(loaded == 1, "menuLoadedWrong", new { loaded });

        var full = new GameMenu(true).Start(6);
        var expectedSix = new Level(6).Play();
        Expect.That(full == expectedSix, "wrongFullMenu", new { full, expected = expectedSix });
    }

    [Check("menu-knows-only-slots")]
    static void MenuKnowsOnlySlots()
    {
        Expect.That(typeof(ILevel).IsAssignableFrom(typeof(LevelSlot)), "slotNotALevel");
        Expect.That(!typeof(Level).IsAssignableFrom(typeof(LevelSlot)), "slotIsLevel");

        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "GameMenu"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Any(n => n.Identifier.ValueText == "Level");
            Expect.That(!named, "menuNamesLevel");
        }
    }
}
