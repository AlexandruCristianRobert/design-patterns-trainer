using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class EscapeRoomChecks
{
    sealed class TestLock(int id) : ILock
    {
        public string Describe() => $"test lock {id}";
    }

    sealed class TestClue(int id) : IClue
    {
        public string Describe() => $"test clue {id}";
    }

    // A theme the program has never seen. It numbers what it makes, so the lines show which lock and clue were used.
    sealed class TestTheme : IRoomTheme
    {
        public int Locks { get; private set; }
        public int Clues { get; private set; }

        public ILock MakeLock() => new TestLock(++Locks);
        public IClue MakeClue() => new TestClue(++Clues);
    }

    // The source of `user` names none of the program's classes that implement or derive from any of `kinds`.
    static void NamesNoConcreteClass(string user, params Type[] kinds)
    {
        var classes = kinds[0].Assembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && kinds.Any(k => k.IsAssignableFrom(t)) && t.DeclaringType != typeof(EscapeRoomChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(c => c.Identifier.ValueText == user))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "userNamesConcreteClass", new { user, type = named });
        }
    }

    [Check("prepare-describes-each-puzzle")]
    static void PrepareDescribesEachPuzzle()
    {
        var theme = new TestTheme();
        var lines = string.Join(" | ", new RoomSetup(theme).Prepare(3));

        Expect.That(lines == "Puzzle 1: test clue 1 opens test lock 1 | Puzzle 2: test clue 2 opens test lock 2 | Puzzle 3: test clue 3 opens test lock 3", "wrongLines", new { actual = lines });
        Expect.That(theme.Locks == 3 && theme.Clues == 3, "wrongCount", new { locks = theme.Locks, clues = theme.Clues });
    }

    [Check("pirate-room-matches")]
    static void PirateRoomMatches()
    {
        var lines = string.Join(" | ", new RoomSetup(new PirateTheme()).Prepare(2));

        Expect.That(lines == "Puzzle 1: torn map opens brass chest lock | Puzzle 2: torn map opens brass chest lock", "wrongPirate", new { actual = lines });
    }

    [Check("space-room-matches")]
    static void SpaceRoomMatches()
    {
        var lines = string.Join(" | ", new RoomSetup(new SpaceTheme()).Prepare(2));

        Expect.That(lines == "Puzzle 1: crackling radio opens keypad lock | Puzzle 2: crackling radio opens keypad lock", "wrongSpace", new { actual = lines });
    }

    [Check("space-theme-makes-new-space-pieces")]
    static void SpaceThemeMakesNewSpacePieces()
    {
        IRoomTheme space = new SpaceTheme();
        var firstLock = space.MakeLock();
        var secondLock = space.MakeLock();
        var firstClue = space.MakeClue();
        var secondClue = space.MakeClue();

        Expect.That(firstLock is KeypadLock, "wrongLock", new { actual = firstLock?.GetType().Name ?? "null" });
        Expect.That(firstClue is RadioClue, "wrongClue", new { actual = firstClue?.GetType().Name ?? "null" });
        Expect.That(!ReferenceEquals(firstLock, secondLock) && !ReferenceEquals(firstClue, secondClue), "reusesPiece");
    }

    [Check("room-setup-knows-only-the-theme")]
    static void RoomSetupKnowsOnlyTheTheme()
    {
        NamesNoConcreteClass("RoomSetup", typeof(ILock), typeof(IClue), typeof(IRoomTheme));
    }
}
