using DesignPatterns.Checks;
using Microsoft.CodeAnalysis.CSharp.Syntax;

static class CueChecks
{
    // A kind of cue the program has never seen. It counts its copies and remembers the last one.
    sealed class TestCue : ICue
    {
        public Dictionary<string, int> Levels { get; } = [];
        public Fade Fade { get; } = new(0);
        public int Copies { get; private set; }
        public TestCue? LastCopy { get; private set; }

        public string Describe() => "test cue";

        public ICue Clone()
        {
            Copies++;
            LastCopy = new TestCue();
            return LastCopy;
        }
    }

    // One cue of each kind, already set up with lamp levels.
    static ICue[] Samples()
    {
        var wash = new WashCue("blue", 5);
        wash.Levels["side"] = 60;
        wash.Levels["back"] = 20;

        var spot = new SpotCue("Ophelia", 2);
        spot.Levels["follow"] = 90;

        return [wash, spot];
    }

    [Check("cues-describe-themselves")]
    static void CuesDescribeThemselves()
    {
        var wash = new WashCue("blue", 5);
        wash.Levels["side"] = 60;
        wash.Levels["back"] = 20;
        wash.Levels["front"] = 75;
        var spot = new SpotCue("Ophelia", 2);
        spot.Levels["follow"] = 90;
        var dark = new WashCue("red", 0);

        Expect.That(wash.Describe() == "blue wash, 5 s fade: back 20%, front 75%, side 60%", "wrongWash", new { expected = "blue wash, 5 s fade: back 20%, front 75%, side 60%", actual = wash.Describe() });
        Expect.That(spot.Describe() == "spot on Ophelia, 2 s fade: follow 90%", "wrongSpot", new { expected = "spot on Ophelia, 2 s fade: follow 90%", actual = spot.Describe() });
        Expect.That(dark.Describe() == "red wash, 0 s fade: no lamps", "wrongEmpty", new { expected = "red wash, 0 s fade: no lamps", actual = dark.Describe() });
    }

    [Check("copies-keep-their-kind")]
    static void CopiesKeepTheirKind()
    {
        foreach (var cue in Samples())
        {
            var type = cue.GetType().Name;
            var copy = cue.Clone();
            Expect.That(copy is not null && !ReferenceEquals(copy, cue), "sameObject", new { type });
            Expect.That(copy!.GetType() == cue.GetType(), "wrongKind", new { type, actual = copy.GetType().Name });
            Expect.That(copy.Describe() == cue.Describe(), "differentCopy", new { type, expected = cue.Describe(), actual = copy.Describe() });
        }
    }

    [Check("copies-are-independent")]
    static void CopiesAreIndependent()
    {
        foreach (var cue in Samples())
        {
            var type = cue.GetType().Name;
            var before = cue.Describe();
            var copy = cue.Clone();

            copy.Levels["house"] = 10;
            foreach (var lamp in copy.Levels.Keys.ToList()) copy.Levels[lamp] = 0;
            Expect.That(cue.Describe() == before, "sharedLevels", new { type, actual = cue.Describe() });

            copy.Fade.Seconds = 30;
            Expect.That(cue.Describe() == before, "sharedFade", new { type, actual = cue.Describe() });
        }
    }

    [Check("copying-leaves-the-original-alone")]
    static void CopyingLeavesTheOriginalAlone()
    {
        foreach (var cue in Samples())
        {
            var type = cue.GetType().Name;
            var before = cue.Describe();
            var stack = new CueStack();
            stack.Add(cue);
            var copy = stack.CopyOf(0);

            Expect.That(cue.Describe() == before, "originalChanged", new { type, actual = cue.Describe() });
            Expect.That(copy is not null && !ReferenceEquals(copy, cue), "stackSameObject", new { type });
            Expect.That(copy!.GetType() == cue.GetType(), "stackWrongKind", new { type, actual = copy.GetType().Name });
            Expect.That(stack.Count == 2, "wrongCount", new { count = stack.Count });
        }
    }

    [Check("stack-copies-any-cue")]
    static void StackCopiesAnyCue()
    {
        var stack = new CueStack();
        var first = new TestCue();
        stack.Add(new WashCue("green", 1));
        stack.Add(first);

        var copy = stack.CopyOf(1);
        Expect.That(first.Copies == 1 && ReferenceEquals(copy, first.LastCopy), "notTheCopy", new { copies = first.Copies });
        Expect.That(stack.Count == 3, "wrongCount", new { count = stack.Count });

        var second = (TestCue)copy;
        var again = stack.CopyOf(2);
        Expect.That(second.Copies == 1 && ReferenceEquals(again, second.LastCopy), "copyNotAdded");
    }

    [Check("stack-names-no-cue-class")]
    static void StackNamesNoCueClass()
    {
        var classes = typeof(ICue).Assembly.GetTypes()
            .Where(t => t.IsClass && typeof(ICue).IsAssignableFrom(t) && t.DeclaringType != typeof(CueChecks))
            .Select(t => t.Name).ToHashSet();
        foreach (var declaration in Source.Root.DescendantNodes().OfType<TypeDeclarationSyntax>().Where(d => d.Identifier.ValueText == "CueStack"))
        {
            var named = declaration.DescendantNodes().OfType<SimpleNameSyntax>().Select(n => n.Identifier.ValueText).FirstOrDefault(classes.Contains);
            Expect.That(named is null, "stackNamesCueClass", new { type = named });
        }
    }
}
