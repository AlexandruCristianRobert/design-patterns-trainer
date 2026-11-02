using DesignPatterns.Checks;

static class PronunciationChecks
{
    // All Checks share one load of the program, so the static counts may already be above 0 when a Check starts.
    // Each Check therefore counts only the connections and requests made while it runs.

    [Check("connects-on-first-word")]
    static void ConnectsOnFirstWord()
    {
        var before = VoiceServer.Connections;
        var voice = new CachedVoice("Spanish", true);
        var early = VoiceServer.Connections - before;
        Expect.That(early == 0, "connectedTooEarly", new { connections = early });

        voice.Say("hola");
        var connections = VoiceServer.Connections - before;
        Expect.That(connections == 1, "notConnectedOnFirstWord", new { connections });
    }

    [Check("connects-once")]
    static void ConnectsOnce()
    {
        var connectionsBefore = VoiceServer.Connections;
        var requestsBefore = VoiceServer.Requests;
        var voice = new CachedVoice("Italian", true);
        foreach (var word in new[] { "ciao", "grazie", "prego", "buongiorno" })
            voice.Say(word);
        var connections = VoiceServer.Connections - connectionsBefore;
        var requests = VoiceServer.Requests - requestsBefore;

        Expect.That(connections == 1, "connectedMoreThanOnce", new { connections });
        Expect.That(requests == 4, "wrongNewWordRequests", new { requests });
    }

    [Check("repeated-words-asked-once")]
    static void RepeatedWordsAskedOnce()
    {
        var before = VoiceServer.Requests;
        var voice = new CachedVoice("Spanish", true);
        string[] answers = [voice.Say("hola"), voice.Say("adios"), voice.Say("hola"), voice.Say("hola"), voice.Say("adios")];
        var requests = VoiceServer.Requests - before;
        var actual = string.Join(" / ", answers);

        Expect.That(actual == "Spanish voice: hola / Spanish voice: adios / Spanish voice: hola / Spanish voice: hola / Spanish voice: adios",
            "wrongRepeats", new { actual });
        Expect.That(requests == 2, "askedAgain", new { requests });
    }

    [Check("signed-out-hears-nothing")]
    static void SignedOutHearsNothing()
    {
        var connectionsBefore = VoiceServer.Connections;
        var requestsBefore = VoiceServer.Requests;
        var voice = new CachedVoice("French", false);
        var first = voice.Say("merci");
        var second = voice.Say("bonjour");
        var connections = VoiceServer.Connections - connectionsBefore;
        var requests = VoiceServer.Requests - requestsBefore;

        Expect.That(first == "Sign in to hear merci" && second == "Sign in to hear bonjour", "wrongRefusal", new { first, second });
        Expect.That(connections == 0 && requests == 0, "usedServerSignedOut", new { connections, requests });
    }

    [Check("words-sound-like-the-server")]
    static void WordsSoundLikeTheServer()
    {
        var heard = new CachedVoice("German", true).Say("danke");
        var real = new VoiceServer("German").Say("danke");

        Expect.That(heard == real && real == "German voice: danke", "differentWord", new { heard, real });
    }

    [Check("cached-voice-is-a-voice")]
    static void CachedVoiceIsAVoice()
    {
        Expect.That(typeof(IVoice).IsAssignableFrom(typeof(VoiceServer)), "serverNotAVoice");
        Expect.That(typeof(IVoice).IsAssignableFrom(typeof(CachedVoice)), "cachedNotAVoice");
        Expect.That(!typeof(VoiceServer).IsAssignableFrom(typeof(CachedVoice)), "cachedIsServer");
    }
}
