using DesignPatterns.Checks;

static class KaraokeChecks
{
    static KaraokeBox NewBox() => new(new() { [7] = "Volare", [12] = "Dancing Queen", [31] = "Wonderwall" });

    // "refused" when the call throws an ArgumentException, otherwise "accepted".
    static string Outcome(Action call)
    {
        try { call(); return "accepted"; }
        catch (ArgumentException) { return "refused"; }
    }

    [Check("box-plays-by-number")]
    static void BoxPlaysByNumber()
    {
        var box = NewBox();
        var silent = box.Playing();
        box.Start();
        var startWithNothing = box.Playing();
        box.Load(7);
        var loadedOnly = box.Playing();
        box.Start();
        var started = box.Playing();
        box.Load(12);
        var reloaded = box.Playing();
        box.Start();
        var second = box.Playing();
        box.Halt();
        var halted = box.Playing();
        var unknown = Outcome(() => box.Load(99));
        var songs = string.Join(", ", box.Songbook().OrderBy(s => s.Key).Select(s => $"{s.Key} {s.Value}"));

        Expect.That(silent == 0 && startWithNothing == 0, "silentBoxPlays", new { silent, startWithNothing });
        Expect.That(loadedOnly == 0 && started == 7, "wrongStart", new { loadedOnly, started });
        Expect.That(reloaded == 0 && second == 12, "wrongReload", new { reloaded, second });
        Expect.That(halted == 0, "haltIgnored", new { halted });
        Expect.That(unknown == "refused", "unknownNumberLoaded");
        Expect.That(songs == "7 Volare, 12 Dancing Queen, 31 Wonderwall", "wrongSongbook", new { actual = songs });
    }

    [Check("play-by-title")]
    static void PlayByTitle()
    {
        var box = NewBox();
        ISongPlayer player = new BoxPlayer(box);
        player.Play("Dancing Queen");
        var first = (box.Playing(), player.NowPlaying());
        player.Play("volare");
        var second = (box.Playing(), player.NowPlaying());

        Expect.That(first == (12, "Dancing Queen"), "wrongFirst", new { number = first.Item1, title = first.Item2 });
        Expect.That(second == (7, "Volare"), "wrongSecond", new { number = second.Item1, title = second.Item2 });
    }

    [Check("stop-silences-the-box")]
    static void StopSilencesTheBox()
    {
        var box = NewBox();
        ISongPlayer player = new BoxPlayer(box);
        var before = player.NowPlaying();
        player.Play("Wonderwall");
        player.Stop();

        Expect.That(before == "", "nothingWasPlaying", new { actual = before });
        Expect.That(box.Playing() == 0, "boxStillPlays", new { number = box.Playing() });
        Expect.That(player.NowPlaying() == "", "stillNamesASong", new { actual = player.NowPlaying() });
    }

    [Check("unknown-titles-are-refused")]
    static void UnknownTitlesAreRefused()
    {
        var box = NewBox();
        ISongPlayer player = new BoxPlayer(box);
        player.Play("Volare");
        var outcome = Outcome(() => player.Play("Bohemian Rhapsody"));

        Expect.That(outcome == "refused", "unknownAccepted");
        Expect.That(box.Playing() == 7, "boxDisturbed", new { number = box.Playing() });
    }

    [Check("now-playing-asks-the-box")]
    static void NowPlayingAsksTheBox()
    {
        var box = new KaraokeBox(new() { [3] = "Africa", [45] = "Respect" });
        ISongPlayer player = new BoxPlayer(box);
        box.Load(45);
        box.Start();
        var pressed = player.NowPlaying();
        player.Play("Africa");
        box.Halt();
        var halted = player.NowPlaying();

        Expect.That(pressed == "Respect", "missedTheButtons", new { actual = pressed });
        Expect.That(halted == "", "missedTheHalt", new { actual = halted });
    }

    [Check("box-stays-as-it-is")]
    static void BoxStaysAsItIs()
    {
        Expect.That(typeof(ISongPlayer).IsAssignableFrom(typeof(BoxPlayer)), "notASongPlayer");
        Expect.That(!typeof(ISongPlayer).IsAssignableFrom(typeof(KaraokeBox)), "boxChanged");
    }
}
